#include <pebble.h>
#include "strings.h"

// Must match the action values used in src/pkjs/index.js
typedef enum {
  ACTION_REQUEST_SYNC   = 0, // watch -> phone: "send me the current list"
  ACTION_SYNC_ITEM      = 1, // phone -> watch: one item (itemIndex, itemName, itemDone)
  ACTION_SYNC_DONE      = 2, // phone -> watch: end of the item stream
  ACTION_TOGGLE_ITEM    = 3, // watch -> phone: item at itemIndex now has itemDone
  ACTION_ADD_ITEM       = 4, // watch -> phone: add itemName to the list
  ACTION_ERROR          = 5, // phone -> watch: errorMsg describes what went wrong
  ACTION_NOT_CONFIGURED = 6, // phone -> watch: no Bring! account configured yet
  ACTION_SYNC_START     = 7, // phone -> watch: a fresh item stream is starting, discard the old one
} BringAction;

// Must match the ERR_* values in src/pkjs/index.js
typedef enum {
  ERR_NONE           = 0,
  ERR_CONNECT_BRING  = 1, // could not authenticate with Bring!
  ERR_READ_LIST      = 2, // could not read the list
  ERR_LOGIN          = 3, // login failed while saving the configuration
  ERR_NO_LISTS       = 4, // the account has no lists
  ERR_LIST_NOT_FOUND = 5, // errorMsg holds the requested list name
  ERR_PHONE          = 6, // watch-local: the phone never answered
} BringError;

#define MAX_ITEMS 80
#define MAX_NAME_LEN 48
#define DICTATION_BUFFER_SIZE 128

// Must match the category order in src/pkjs/categorize.js
#define ICON_CATEGORY_COUNT 8
static const uint32_t CATEGORY_RESOURCE_IDS[ICON_CATEGORY_COUNT] = {
  RESOURCE_ID_ICON_DEFAULT,
  RESOURCE_ID_ICON_BREAD,
  RESOURCE_ID_ICON_DAIRY,
  RESOURCE_ID_ICON_FRUIT,
  RESOURCE_ID_ICON_VEGETABLE,
  RESOURCE_ID_ICON_MEAT,
  RESOURCE_ID_ICON_DRINK,
  RESOURCE_ID_ICON_CLEANING,
};

typedef struct {
  char name[MAX_NAME_LEN];
  bool done;
  uint8_t icon;
} BringItem;

typedef enum {
  STATE_LOADING,
  STATE_READY,
  STATE_ERROR,
  STATE_NOT_CONFIGURED,
} AppState;

static Window *s_window;
static MenuLayer *s_menu_layer;
static TextLayer *s_message_layer;
static DictationSession *s_dictation_session;
static GBitmap *s_category_icons[ICON_CATEGORY_COUNT];
static GBitmap *s_add_icon;

static BringItem s_items[MAX_ITEMS];
static int s_item_count = 0;
static AppState s_state = STATE_LOADING;
// Sized for the longest localized message plus a list name of up to
// MAX_ERROR_DETAIL characters (src/pkjs/index.js).
static char s_message_text[256];

#define SYNC_RETRY_INTERVAL_MS 4000
#define MAX_SYNC_RETRIES 6

static AppTimer *s_retry_timer;
static int s_retry_count = 0;

static void update_ui(void);
static void marquee_restart(void);
static void marquee_stop(void);

// ---------------------------------------------------------------------------
// Localization
//
// The text tables live in strings.c. The language is picked from the
// watch's system language (i18n_get_system_locale()).
// ---------------------------------------------------------------------------

static const Strings *s_strings; // set by detect_language()

static void detect_language(void) {
  s_strings = strings_for_locale(i18n_get_system_locale()); // e.g. "de_DE"
}

// Removes a trailing incomplete UTF-8 sequence, left behind when a long
// localized message was truncated to fit the buffer, so it never ends in half
// of a multi-byte character.
static void truncate_utf8_in_place(char *buf) {
  size_t len = strlen(buf);
  size_t lead = len;
  while (lead > 0 && ((unsigned char)buf[lead - 1] & 0xC0) == 0x80) {
    lead--; // skip continuation bytes
  }
  if (lead == 0) {
    return;
  }
  lead--; // index of the lead byte of the last character
  unsigned char c = (unsigned char)buf[lead];
  size_t expected = (c >= 0xF0) ? 4 : (c >= 0xE0) ? 3 : (c >= 0xC0) ? 2 : 1;
  if (len - lead < expected) {
    buf[lead] = '\0';
  }
}

static void set_error_message(BringError code, const char *detail) {
  const char *text = s_strings->err_generic;
  switch (code) {
    case ERR_CONNECT_BRING: text = s_strings->err_connect; break;
    case ERR_READ_LIST:     text = s_strings->err_read; break;
    case ERR_LOGIN:         text = s_strings->err_login; break;
    case ERR_NO_LISTS:      text = s_strings->err_no_lists; break;
    case ERR_PHONE:         text = s_strings->err_phone; break;
    case ERR_LIST_NOT_FOUND:
      snprintf(s_message_text, sizeof(s_message_text), s_strings->err_list_not_found, detail ? detail : "");
      truncate_utf8_in_place(s_message_text);
      return;
    default: break;
  }
  strncpy(s_message_text, text, sizeof(s_message_text) - 1);
  s_message_text[sizeof(s_message_text) - 1] = '\0';
  truncate_utf8_in_place(s_message_text);
}


// ---------------------------------------------------------------------------
// AppMessage: outgoing
//
// The phone-side JS may not be attached yet when the watch app starts (e.g.
// Bluetooth just reconnected), so the initial sync request is retried with a
// simple fixed interval until an answer (items, error, or "not configured")
// comes back.
// ---------------------------------------------------------------------------

static void send_request_sync_message(void) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }
  dict_write_int32(iter, MESSAGE_KEY_action, ACTION_REQUEST_SYNC);
  // Lets the phone show its configuration page in the watch's language.
  const char *locale = i18n_get_system_locale();
  if (locale) {
    dict_write_cstring(iter, MESSAGE_KEY_locale, locale);
  }
  app_message_outbox_send();
}

static void retry_timer_callback(void *data) {
  s_retry_timer = NULL;
  if (s_state != STATE_LOADING) {
    return; // an answer arrived while we were waiting to retry
  }
  s_retry_count++;
  if (s_retry_count > MAX_SYNC_RETRIES) {
    s_state = STATE_ERROR;
    set_error_message(ERR_PHONE, NULL);
    update_ui();
    return;
  }
  send_request_sync_message();
  s_retry_timer = app_timer_register(SYNC_RETRY_INTERVAL_MS, retry_timer_callback, NULL);
}

static void request_sync(void) {
  s_item_count = 0;
  s_retry_count = 0;
  s_state = STATE_LOADING;
  update_ui();

  if (s_retry_timer) {
    app_timer_cancel(s_retry_timer);
  }
  send_request_sync_message();
  s_retry_timer = app_timer_register(SYNC_RETRY_INTERVAL_MS, retry_timer_callback, NULL);
}

static void send_toggle_item(int index, const char *name, bool done) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }
  dict_write_int32(iter, MESSAGE_KEY_action, ACTION_TOGGLE_ITEM);
  dict_write_int32(iter, MESSAGE_KEY_itemIndex, index);
  dict_write_cstring(iter, MESSAGE_KEY_itemName, name);
  dict_write_int32(iter, MESSAGE_KEY_itemDone, done ? 1 : 0);
  app_message_outbox_send();
}

static void send_add_item(const char *name) {
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) {
    return;
  }
  dict_write_int32(iter, MESSAGE_KEY_action, ACTION_ADD_ITEM);
  dict_write_cstring(iter, MESSAGE_KEY_itemName, name);
  app_message_outbox_send();
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

// Message fonts from largest to smallest; show_message() picks the first one
// whose wrapped text fits on screen.
static const char *const MESSAGE_FONT_KEYS[] = {
  FONT_KEY_GOTHIC_28_BOLD,
  FONT_KEY_GOTHIC_24_BOLD,
  FONT_KEY_GOTHIC_18_BOLD,
  FONT_KEY_GOTHIC_14_BOLD,
};
#define MESSAGE_FONT_COUNT (int)(sizeof(MESSAGE_FONT_KEYS) / sizeof(MESSAGE_FONT_KEYS[0]))

// Shows a full-screen message (loading, setup hint, errors) in the largest
// font that fits, centered horizontally and vertically.
static void show_message(const char *text) {
  Layer *window_layer = window_get_root_layer(s_window);
  GRect bounds = layer_get_bounds(window_layer);
  // Round displays need a wider inset so text doesn't hit the curved edge.
  int16_t h_inset = PBL_IF_ROUND_ELSE(bounds.size.w / 8, 6);
  int16_t v_inset = PBL_IF_ROUND_ELSE(bounds.size.h / 10, 4);
  GRect area = grect_inset(bounds, GEdgeInsets(v_inset, h_inset));

  GFont font = NULL;
  GSize size = GSizeZero;
  for (int i = 0; i < MESSAGE_FONT_COUNT; i++) {
    font = fonts_get_system_font(MESSAGE_FONT_KEYS[i]);
    size = graphics_text_layout_get_content_size(text, font, area,
                                                 GTextOverflowModeWordWrap, GTextAlignmentCenter);
    if (size.h <= area.size.h) {
      break;
    }
  }
  // Text layout draws descenders a few pixels below the reported content
  // height; give the frame extra room (it may spill into the inset margin).
  int16_t h = size.h + 8;
  // Gothic glyphs sit low in their line box; nudge up for optical centering.
  GRect frame = GRect(area.origin.x, bounds.origin.y + (bounds.size.h - size.h) / 2 - 3,
                      area.size.w, h);

  layer_set_frame(text_layer_get_layer(s_message_layer), frame);
  text_layer_set_font(s_message_layer, font);
  text_layer_set_text(s_message_layer, text);
  layer_set_hidden(text_layer_get_layer(s_message_layer), false);
  layer_set_hidden(menu_layer_get_layer(s_menu_layer), true);
}

static void update_ui(void) {
  switch (s_state) {
    case STATE_LOADING:
      marquee_stop();
      show_message(s_strings->loading);
      break;
    case STATE_NOT_CONFIGURED:
      marquee_stop();
      show_message(s_strings->not_configured);
      break;
    case STATE_ERROR:
      marquee_stop();
      show_message(s_message_text);
      break;
    case STATE_READY:
      layer_set_hidden(text_layer_get_layer(s_message_layer), true);
      layer_set_hidden(menu_layer_get_layer(s_menu_layer), false);
      menu_layer_reload_data(s_menu_layer);
      marquee_restart(); // the items may have changed under the selection
      break;
  }
}

// ---------------------------------------------------------------------------
// Dictation (voice input for "add item")
// ---------------------------------------------------------------------------

static void dictation_session_callback(DictationSession *session, DictationSessionStatus status,
                                        char *transcription, void *context) {
  if (status == DictationSessionStatusSuccess) {
    send_add_item(transcription);
  }
  // On failure/cancel the dictation UI already showed its own message; nothing else to do.
}

// ---------------------------------------------------------------------------
// MenuLayer callbacks
//
// Section 0 has a single "+ Add item" row, drawn by the system. Section 1
// lists the current Bring! items as compact one-line rows (icon + name);
// purchased items are greyed out and struck through. On round watches the
// focused item row is a bit taller than the others (the MenuLayer only lays
// out a taller selected row correctly in its center-focused mode, which is the
// default on round and not used on rectangular watches).
// ---------------------------------------------------------------------------

// The system's default cell height for apps, kept for the "+ Add item" row.
// Time 2 and Round 2 use the firmware's "large" menu style, the others "medium".
#if PBL_DISPLAY_HEIGHT >= 200
#define ADD_ROW_HEIGHT 61
#define ROW_INSET 10    // left inset of the system menu cells
#define ICON_TEXT_GAP 9 // gap between icon and title in the system menu cells
#else
#define ADD_ROW_HEIGHT 44
#define ROW_INSET 5
#define ICON_TEXT_GAP 5
#endif

#define ITEM_ROW_HEIGHT PBL_IF_ROUND_ELSE(34, 32)
#define ITEM_ROW_FOCUSED_HEIGHT PBL_IF_ROUND_ELSE(46, ITEM_ROW_HEIGHT)

static int16_t menu_get_cell_height_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *context) {
  if (cell_index->section == 0) {
    return ADD_ROW_HEIGHT;
  }
  return menu_layer_is_index_selected(menu_layer, cell_index) ? ITEM_ROW_FOCUSED_HEIGHT : ITEM_ROW_HEIGHT;
}

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *context) {
  return 2;
}

static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  if (section_index == 0) {
    return 1;
  }
  return (uint16_t)s_item_count;
}

static int16_t menu_get_header_height_callback(MenuLayer *menu_layer, uint16_t section_index, void *context) {
  return (section_index == 1 && s_item_count > 0) ? MENU_CELL_BASIC_HEADER_HEIGHT : 0;
}

static void menu_draw_header_callback(GContext *ctx, const Layer *cell_layer, uint16_t section_index,
                                       void *context) {
  if (section_index == 1) {
#if PBL_ROUND
    // The system header is left-aligned, which the round bezel clips; centre it instead
    // (same font and nudge as menu_cell_basic_header_draw).
    GRect box = layer_get_bounds(cell_layer);
    box.origin.y -= 1;
    graphics_draw_text(ctx, s_strings->list_header, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD), box,
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
#else
    menu_cell_basic_header_draw(ctx, cell_layer, s_strings->list_header);
#endif
  }
}

// Horizontal layout of an item row, shared by the drawing code and the marquee.
typedef struct {
  GBitmap *icon;
  GSize icon_size;
  int16_t text_offset; // from the icon's left edge to the text
  int16_t max_text_w;  // width of the text column
  int16_t full_text_w; // width of the whole name on one line
} ItemRowLayout;

// Wide enough for any MAX_NAME_LEN name on one line.
#define TEXT_MEASURE_WIDTH 2000

static GFont item_font(void) {
  return fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD); // the system menu cell title font
}

static ItemRowLayout item_row_layout(const BringItem *item, int16_t cell_w) {
  ItemRowLayout l;
  l.icon = (item->icon < ICON_CATEGORY_COUNT) ? s_category_icons[item->icon] : NULL;
  l.icon_size = l.icon ? gbitmap_get_bounds(l.icon).size : GSize(0, 0);
  l.text_offset = l.icon ? l.icon_size.w + ICON_TEXT_GAP : 0;
  // On round, rows above and below the centre are narrower, so leave more room at the sides.
  l.max_text_w = PBL_IF_ROUND_ELSE(cell_w * 4 / 5, cell_w - 2 * ROW_INSET) - l.text_offset;
  l.full_text_w = graphics_text_layout_get_content_size(item->name, item_font(),
                                                        GRect(0, 0, TEXT_MEASURE_WIDTH, 30),
                                                        GTextOverflowModeTrailingEllipsis,
                                                        GTextAlignmentLeft).w;
  return l;
}

// ---------------------------------------------------------------------------
// Marquee: the highlighted item scrolls horizontally when its name does not
// fit, so it can be read in full. Scrolling starts MARQUEE_START_DELAY_MS
// after the item was highlighted, pauses at the end, jumps back to the start
// and repeats. Only the highlighted row ever scrolls; the others keep their
// ellipsis. The highlighted row also shows the ellipsis while at offset 0.
// ---------------------------------------------------------------------------

#define MARQUEE_START_DELAY_MS 1000
#define MARQUEE_FRAME_MS 50
#define MARQUEE_STEP_PX 2
#define MARQUEE_END_PAUSE_MS 1000

static AppTimer *s_marquee_timer;
static int16_t s_marquee_offset = 0;

// How far the highlighted item's name has to scroll to show its end (0 when
// it fits or no item is highlighted).
static int16_t selected_item_overflow(void) {
  if (s_state != STATE_READY || !s_menu_layer) {
    return 0;
  }
  MenuIndex index = menu_layer_get_selected_index(s_menu_layer);
  if (index.section != 1 || index.row >= s_item_count) {
    return 0;
  }
  int16_t cell_w = layer_get_bounds(menu_layer_get_layer(s_menu_layer)).size.w;
  ItemRowLayout l = item_row_layout(&s_items[index.row], cell_w);
  return l.full_text_w > l.max_text_w ? l.full_text_w - l.max_text_w : 0;
}

static void marquee_timer_callback(void *data) {
  s_marquee_timer = NULL;
  int16_t max_offset = selected_item_overflow();
  if (max_offset <= 0) {
    s_marquee_offset = 0;
    return; // nothing to scroll; restarted when the selection changes
  }

  uint32_t next_ms = MARQUEE_FRAME_MS;
  if (s_marquee_offset >= max_offset) {
    s_marquee_offset = 0; // paused at the end: back to the start
    next_ms = MARQUEE_START_DELAY_MS;
  } else {
    s_marquee_offset += MARQUEE_STEP_PX;
    if (s_marquee_offset >= max_offset) {
      s_marquee_offset = max_offset;
      next_ms = MARQUEE_END_PAUSE_MS;
    }
  }
  layer_mark_dirty(menu_layer_get_layer(s_menu_layer));
  s_marquee_timer = app_timer_register(next_ms, marquee_timer_callback, NULL);
}

static void marquee_stop(void) {
  if (s_marquee_timer) {
    app_timer_cancel(s_marquee_timer);
    s_marquee_timer = NULL;
  }
  s_marquee_offset = 0;
}

static void marquee_restart(void) {
  marquee_stop();
  s_marquee_timer = app_timer_register(MARQUEE_START_DELAY_MS, marquee_timer_callback, NULL);
}

// Set explicitly so the marquee can mask the row's sides in the same colour.
#define ROW_HIGHLIGHT_BG GColorBlack
#define ROW_HIGHLIGHT_FG GColorWhite

// One-line item row: icon + name, left-aligned like the system cells on
// rectangular watches, centred as a group on round ones.
static void draw_item_row(GContext *ctx, const Layer *cell_layer, const BringItem *item) {
  GRect bounds = layer_get_bounds(cell_layer);
  bool highlighted = menu_cell_layer_is_highlighted(cell_layer);
  ItemRowLayout l = item_row_layout(item, bounds.size.w);

  int16_t max_offset = l.full_text_w > l.max_text_w ? l.full_text_w - l.max_text_w : 0;
  int16_t scroll = highlighted ? (s_marquee_offset < max_offset ? s_marquee_offset : max_offset) : 0;
  int16_t text_w = l.full_text_w < l.max_text_w ? l.full_text_w : l.max_text_w;
  int16_t x = PBL_IF_ROUND_ELSE((bounds.size.w - l.text_offset - text_w) / 2, ROW_INSET);
  int16_t text_x = x + l.text_offset;

  if (item->done) {
    GColor grey = highlighted ? PBL_IF_COLOR_ELSE(GColorLightGray, GColorWhite)
                              : PBL_IF_COLOR_ELSE(GColorDarkGray, GColorBlack);
    graphics_context_set_text_color(ctx, grey);
    graphics_context_set_stroke_color(ctx, grey);
  }

  // Gothic 24 leaves space above its glyphs; shift the box up so the text is centred.
  int16_t text_y = (bounds.size.h - 24) / 2 - 4;
  GRect text_box;
  if (scroll > 0) {
    // The whole name, shifted left; a little slack so it is never ellipsized.
    text_box = GRect(text_x - scroll, text_y, l.full_text_w + 8, 30);
  } else {
    text_box = GRect(text_x, text_y, text_w, 30);
  }
  graphics_draw_text(ctx, item->name, item_font(), text_box, GTextOverflowModeTrailingEllipsis,
                     GTextAlignmentLeft, NULL);

  if (item->done) {
    int16_t y = bounds.size.h / 2 + 1;
    int16_t line_w = scroll > 0 ? l.full_text_w : text_w;
    graphics_draw_line(ctx, GPoint(text_box.origin.x, y), GPoint(text_box.origin.x + line_w, y));
  }

  if (scroll > 0) {
    // There is no clipping for drawing within a layer, so cover whatever
    // scrolled out of the text column; the icon is drawn on top afterwards.
    graphics_context_set_fill_color(ctx, ROW_HIGHLIGHT_BG);
    graphics_fill_rect(ctx, GRect(0, 0, text_x, bounds.size.h), 0, GCornerNone);
    int16_t right = text_x + l.max_text_w;
    graphics_fill_rect(ctx, GRect(right, 0, bounds.size.w - right, bounds.size.h), 0, GCornerNone);
  }

  if (l.icon) {
    graphics_context_set_compositing_mode(ctx, GCompOpSet); // as the system menu cells do
    graphics_draw_bitmap_in_rect(ctx, l.icon,
                                 GRect(x, (bounds.size.h - l.icon_size.h) / 2, l.icon_size.w, l.icon_size.h));
  }
}

static void menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *context) {
  if (cell_index->section == 0) {
    menu_cell_basic_draw(ctx, cell_layer, s_strings->add_item, s_strings->add_item_hint, s_add_icon);
    return;
  }

  draw_item_row(ctx, cell_layer, &s_items[cell_index->row]);
}

static void menu_selection_changed_callback(MenuLayer *menu_layer, MenuIndex new_index, MenuIndex old_index,
                                            void *context) {
  marquee_restart();
  layer_mark_dirty(menu_layer_get_layer(menu_layer)); // drop the old row's scroll offset at once
}

static void menu_select_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *context) {
  if (cell_index->section == 0) {
    if (s_dictation_session) {
      dictation_session_start(s_dictation_session);
    }
    return;
  }

  BringItem *item = &s_items[cell_index->row];
  item->done = !item->done;
  if (item->done) {
    vibes_double_pulse();
  } else {
    vibes_short_pulse();
  }
  send_toggle_item(cell_index->row, item->name, item->done);
  menu_layer_reload_data(s_menu_layer);
}

// ---------------------------------------------------------------------------
// AppMessage: incoming
// ---------------------------------------------------------------------------

static void inbox_received_callback(DictionaryIterator *iterator, void *context) {
  Tuple *action_tuple = dict_find(iterator, MESSAGE_KEY_action);
  if (!action_tuple) {
    return;
  }

  switch ((BringAction)action_tuple->value->int32) {
    case ACTION_SYNC_START:
      s_item_count = 0;
      break;
    case ACTION_SYNC_ITEM: {
      Tuple *idx_t = dict_find(iterator, MESSAGE_KEY_itemIndex);
      Tuple *name_t = dict_find(iterator, MESSAGE_KEY_itemName);
      Tuple *done_t = dict_find(iterator, MESSAGE_KEY_itemDone);
      Tuple *icon_t = dict_find(iterator, MESSAGE_KEY_itemIcon);
      if (!idx_t || !name_t || !done_t) {
        break;
      }
      int idx = (int)idx_t->value->int32;
      if (idx < 0 || idx >= MAX_ITEMS) {
        break;
      }
      strncpy(s_items[idx].name, name_t->value->cstring, MAX_NAME_LEN - 1);
      s_items[idx].name[MAX_NAME_LEN - 1] = '\0';
      s_items[idx].done = done_t->value->int32 != 0;
      s_items[idx].icon = 0;
      if (icon_t) {
        int icon = (int)icon_t->value->int32;
        if (icon >= 0 && icon < ICON_CATEGORY_COUNT) {
          s_items[idx].icon = (uint8_t)icon;
        }
      }
      if (idx + 1 > s_item_count) {
        s_item_count = idx + 1;
      }
      break;
    }
    case ACTION_SYNC_DONE:
      s_state = STATE_READY;
      update_ui();
      break;
    case ACTION_ERROR: {
      Tuple *code_t = dict_find(iterator, MESSAGE_KEY_errorCode);
      Tuple *msg_t = dict_find(iterator, MESSAGE_KEY_errorMsg);
      s_state = STATE_ERROR;
      set_error_message(code_t ? (BringError)code_t->value->int32 : ERR_NONE,
                        msg_t ? msg_t->value->cstring : NULL);
      update_ui();
      break;
    }
    case ACTION_NOT_CONFIGURED:
      s_state = STATE_NOT_CONFIGURED;
      update_ui();
      break;
    default:
      break;
  }
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_WARNING, "AppMessage dropped: %d", (int)reason);
}

static void outbox_failed_callback(DictionaryIterator *iterator, AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_WARNING, "AppMessage outbox failed: %d", (int)reason);
}

// ---------------------------------------------------------------------------
// Window lifecycle
// ---------------------------------------------------------------------------

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  s_menu_layer = menu_layer_create(bounds);
  menu_layer_set_callbacks(s_menu_layer, NULL, (MenuLayerCallbacks) {
    .get_num_sections = menu_get_num_sections_callback,
    .get_num_rows = menu_get_num_rows_callback,
    .get_cell_height = menu_get_cell_height_callback,
    .get_header_height = menu_get_header_height_callback,
    .draw_header = menu_draw_header_callback,
    .draw_row = menu_draw_row_callback,
    .select_click = menu_select_callback,
    .selection_changed = menu_selection_changed_callback,
  });
  menu_layer_set_highlight_colors(s_menu_layer, ROW_HIGHLIGHT_BG, ROW_HIGHLIGHT_FG);
  menu_layer_set_click_config_onto_window(s_menu_layer, window);
  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));

  // On touchscreen hardware (Pebble Time 2 / Pebble Round 2), tapping a row
  // now fires the same select_click as pressing the SELECT button — no-op
  // on button-only platforms.
  app_touch_navigation_enable(true);

  s_message_layer = text_layer_create(bounds);
  text_layer_set_text_alignment(s_message_layer, GTextAlignmentCenter);
  text_layer_set_font(s_message_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_overflow_mode(s_message_layer, GTextOverflowModeWordWrap);
  layer_add_child(window_layer, text_layer_get_layer(s_message_layer));

  s_dictation_session = dictation_session_create(DICTATION_BUFFER_SIZE, dictation_session_callback, NULL);

  // The colour icons don't convert well to black & white, so those watches show
  // text only (the menu rows skip NULL icons).
  if (PBL_IF_COLOR_ELSE(true, false)) {
    for (int i = 0; i < ICON_CATEGORY_COUNT; i++) {
      s_category_icons[i] = gbitmap_create_with_resource(CATEGORY_RESOURCE_IDS[i]);
    }
    s_add_icon = gbitmap_create_with_resource(RESOURCE_ID_ICON_APP);
  }

  update_ui();
  request_sync();
}

static void window_unload(Window *window) {
  marquee_stop();
  if (s_retry_timer) {
    app_timer_cancel(s_retry_timer);
    s_retry_timer = NULL;
  }
  if (s_dictation_session) {
    dictation_session_destroy(s_dictation_session);
    s_dictation_session = NULL;
  }
  for (int i = 0; i < ICON_CATEGORY_COUNT; i++) {
    if (s_category_icons[i]) {
      gbitmap_destroy(s_category_icons[i]);
      s_category_icons[i] = NULL;
    }
  }
  if (s_add_icon) {
    gbitmap_destroy(s_add_icon);
    s_add_icon = NULL;
  }
  text_layer_destroy(s_message_layer);
  menu_layer_destroy(s_menu_layer);
}

static void init(void) {
  detect_language();
  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });

  app_message_register_inbox_received(inbox_received_callback);
  app_message_register_inbox_dropped(inbox_dropped_callback);
  app_message_register_outbox_failed(outbox_failed_callback);
  // The maximum buffer sizes (about 8 KB each) do not fit in aplite's RAM:
  // app_message_open() then fails and the app can never talk to the phone.
  // Every message is small (names are capped at MAX_NAME_LEN, dictation text
  // at DICTATION_BUFFER_SIZE, error text at about 150 bytes), so aplite gets
  // right-sized buffers; the other platforms keep the maximum.
#if defined(PBL_PLATFORM_APLITE)
  const uint32_t inbox_size = 512;
  const uint32_t outbox_size = 256;
#else
  const uint32_t inbox_size = app_message_inbox_size_maximum();
  const uint32_t outbox_size = app_message_outbox_size_maximum();
#endif
  AppMessageResult open_result = app_message_open(inbox_size, outbox_size);
  if (open_result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "app_message_open failed: %d", (int)open_result);
  }

  window_stack_push(s_window, true);
}

static void deinit(void) {
  window_destroy(s_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
