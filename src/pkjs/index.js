var BringApi = require('./bring-api');
var Config = require('./config');
var Categorize = require('./categorize');
var Text = require('./text');

var ACTION_REQUEST_SYNC = 0;
var ACTION_SYNC_ITEM = 1;
var ACTION_SYNC_DONE = 2;
var ACTION_TOGGLE_ITEM = 3;
var ACTION_ADD_ITEM = 4;
var ACTION_ERROR = 5;
var ACTION_NOT_CONFIGURED = 6;
var ACTION_SYNC_START = 7;

// Error codes sent to the watch, which renders them in its own language.
// Must match the BringError enum in src/c/bring_pebble.c
var ERR_CONNECT_BRING = 1;
var ERR_READ_LIST = 2;
var ERR_LOGIN = 3;
var ERR_NO_LISTS = 4;
var ERR_LIST_NOT_FOUND = 5;

var MAX_ITEMS = 80; // must match MAX_ITEMS in src/c/bring_pebble.c

// The user has entered credentials. The list may still need to be resolved
// (see resolveListThen).
function isConfigured() {
  var s = BringApi.loadState();
  return !!(s.email && s.password);
}

// Watch error code for a failed BringApi.checkAccount result.
function errorCodeFor(result) {
  switch (result.reason) {
    case 'login': return ERR_LOGIN;
    case 'no_lists': return ERR_NO_LISTS;
    case 'list_not_found': return ERR_LIST_NOT_FOUND;
    default: return ERR_CONNECT_BRING;
  }
}

// Checks the saved credentials and list name. On success the session and the
// resolved list are stored; on failure nothing is changed or removed. The
// outcome is remembered for the settings page either way.
function checkSavedSettings(callback) {
  var saved = BringApi.loadState();
  var wanted = BringApi.loadWantedListName();
  BringApi.checkAccount(saved.email, saved.password, wanted, function (result) {
    // The settings may have been changed while the request was running.
    var now = BringApi.loadState();
    if (now.email !== saved.email || now.password !== saved.password ||
        BringApi.loadWantedListName() !== wanted) {
      return;
    }
    if (result.ok) {
      BringApi.saveState(result.state);
    }
    BringApi.saveLastCheck(checkRecord(result, saved.email, wanted, false));
    callback(result);
  });
}

function checkRecord(result, email, wantedListName, isTest) {
  return {
    ok: result.ok,
    reason: result.reason || '',
    lists: result.lists || [],
    listName: result.listName || '',
    wantedListName: wantedListName,
    email: email,
    test: isTest,
    at: Date.now()
  };
}

// Makes sure the saved list name has been resolved to a list, then calls
// `next`. Otherwise (first sync after saving, or saving could not reach
// Bring!) it resolves it now and reports problems to the watch.
function resolveListThen(next) {
  if (BringApi.loadState().listUuid) {
    next();
    return;
  }
  checkSavedSettings(function (result) {
    if (!result.ok) {
      sendError(errorCodeFor(result), result.reason === 'list_not_found' ? BringApi.loadWantedListName() : '');
      return;
    }
    next();
  });
}

// Watch setting: turn off touch input on watches with a touchscreen, so a
// stray tap can't check off an item. Stored here and sent to the watch, which
// keeps its own copy. Default: touch stays on.
var TOUCH_DISABLED_KEY = 'bring_touchDisabled';

function loadTouchDisabled() {
  return localStorage.getItem(TOUCH_DISABLED_KEY) === '1';
}

function saveTouchDisabled(disabled) {
  localStorage.setItem(TOUCH_DISABLED_KEY, disabled ? '1' : '0');
}

// Sent without an action: the watch applies the setting from any message.
function sendWatchSettings() {
  Pebble.sendAppMessage({ touchDisabled: loadTouchDisabled() ? 1 : 0 });
}

function sendNotConfigured() {
  Pebble.sendAppMessage({ action: ACTION_NOT_CONFIGURED });
}

// Longest detail (the list name) sent with an error, in UTF-16 code units.
// At most 3 UTF-8 bytes per unit, so <= 120 bytes; together with the longest
// localized template (~80 bytes) that fits the watch's 256-byte buffer
// (s_message_text in src/c/bring_pebble.c).
var MAX_ERROR_DETAIL = 40;

function sendError(code, detail) {
  var msg = { action: ACTION_ERROR, errorCode: code };
  if (detail) {
    msg.errorMsg = Text.truncateText(detail, MAX_ERROR_DETAIL);
  }
  Pebble.sendAppMessage(msg);
}

// Identifies the latest sync. A newer sync makes a still-streaming older one
// stop, so two streams never interleave on the watch.
var s_syncId = 0;

function sendItemsThenDone(syncId, items, locale) {
  function afterStart() {
    var i = 0;
    function sendNext() {
      if (syncId !== s_syncId) {
        return;
      }
      if (i >= items.length) {
        Pebble.sendAppMessage({ action: ACTION_SYNC_DONE });
        return;
      }
      var item = items[i];
      var index = i;
      Pebble.sendAppMessage(
        {
          action: ACTION_SYNC_ITEM,
          itemIndex: index,
          itemName: item.name,
          itemDone: item.done ? 1 : 0,
          itemIcon: Categorize.categorize(item.name, locale)
        },
        function () { i++; sendNext(); },
        function () { i++; sendNext(); } // best-effort: skip a dropped item instead of stalling the sync
      );
    }
    sendNext();
  }
  // Tells the watch to discard its current list before the new one streams
  // in, so a shrunk list (e.g. an item got completed) doesn't leave stale
  // rows behind.
  Pebble.sendAppMessage({ action: ACTION_SYNC_START }, afterStart, afterStart);
}

function doSync() {
  if (!isConfigured()) {
    sendNotConfigured();
    return;
  }
  resolveListThen(syncList);
}

function syncList() {
  var syncId = ++s_syncId;
  BringApi.ensureAuth(function (authErr, state) {
    if (authErr) {
      sendError(BringApi.isLoginRejected(authErr) ? ERR_LOGIN : ERR_CONNECT_BRING);
      return;
    }
    BringApi.getListItems(state, function (err, items) {
      if (syncId !== s_syncId) {
        return;
      }
      if (err) {
        sendError(ERR_READ_LIST);
        return;
      }
      var merged = [];
      var i;
      for (i = 0; i < items.purchase.length; i++) {
        merged.push({ name: items.purchase[i].itemId, done: false });
      }
      for (i = 0; i < items.recently.length; i++) {
        merged.push({ name: items.recently[i].itemId, done: true });
      }
      // Item names are in the Bring! account's language. If that couldn't be
      // determined, catalog items were left untranslated, i.e. in German.
      sendItemsThenDone(syncId, merged.slice(0, MAX_ITEMS), state.locale || BringApi.BRING_DEFAULT_LOCALE);
    });
  });
}

// Runs `action(state)` with a valid session, resolving the list first if
// needed. Errors go to the watch.
function withAuth(action) {
  if (!isConfigured()) {
    sendNotConfigured();
    return;
  }
  resolveListThen(function () {
    BringApi.ensureAuth(function (authErr, state) {
      if (authErr) {
        sendError(BringApi.isLoginRejected(authErr) ? ERR_LOGIN : ERR_CONNECT_BRING);
        return;
      }
      action(state);
    });
  });
}

Pebble.addEventListener('ready', function () {
  console.log('Bring! companion ready');
});

Pebble.addEventListener('appmessage', function (e) {
  var payload = e.payload;
  console.log('appmessage received, action=' + payload.action);

  if (payload.action === ACTION_REQUEST_SYNC) {
    if (payload.locale) {
      // Remember the watch's language so the config page can match it.
      localStorage.setItem('bring_watchLocale', String(payload.locale));
    }
    // The watch asks on every start, so it also gets the latest settings
    // (e.g. after a reinstall, or if it was not connected when they were saved).
    sendWatchSettings();
    doSync();
    return;
  }

  if (payload.action === ACTION_TOGGLE_ITEM) {
    var toggleOp = payload.itemDone ? 'TO_RECENTLY' : 'TO_PURCHASE';
    withAuth(function (state) {
      BringApi.updateItem(state, payload.itemName, toggleOp, function () {
        // Re-sync regardless of success so the watch always reflects server state.
        doSync();
      });
    });
    return;
  }

  if (payload.action === ACTION_ADD_ITEM) {
    if (!isConfigured()) {
      sendNotConfigured();
      return;
    }
    // Dictation often appends sentence punctuation ("Milk."); drop it.
    var name = Text.stripTrailingPunctuation((payload.itemName || '').trim());
    if (!name) {
      doSync();
      return;
    }
    withAuth(function (state) {
      BringApi.updateItem(state, name, 'TO_PURCHASE', function () {
        doSync();
      });
    });
  }
});

// The watch's current language, preferring the live value from the Pebble app
// over the one remembered from the last sync (the user may have changed the
// watch language since).
function currentWatchLocale() {
  try {
    var info = Pebble.getActiveWatchInfo && Pebble.getActiveWatchInfo();
    if (info && info.language) {
      return String(info.language);
    }
  } catch (e) {
    // No watch connected: fall through to the remembered value.
  }
  return localStorage.getItem('bring_watchLocale') || '';
}

// A check result is shown on the settings page if it is about what the page
// shows: a check of the saved settings, or a test from the last few minutes
// (in case the page could not be reopened with the result right away).
var TEST_RESULT_MAX_AGE_MS = 10 * 60 * 1000;

function openSettings(draft, check) {
  var saved = BringApi.loadState();
  if (!check) {
    var last = BringApi.loadLastCheck();
    if (last && (last.test ? Date.now() - last.at < TEST_RESULT_MAX_AGE_MS
                           : last.email === saved.email)) {
      check = last;
    }
  }
  Pebble.openURL(Config.buildSettingsUrl({
    email: draft ? draft.email : saved.email,
    listName: draft ? draft.listName : BringApi.loadWantedListName(),
    password: draft ? draft.password : '',
    hasPassword: !!saved.password,
    touchDisabled: draft ? !!draft.touchDisabled : loadTouchDisabled(),
    locale: currentWatchLocale(),
    check: check
  }));
}

Pebble.addEventListener('showConfiguration', function () {
  openSettings(null, null);
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e.response) {
    return; // user cancelled
  }
  var data = Config.parseConfigResponse(e.response);
  if (!data) {
    return;
  }
  // The watch setting does not depend on the account, so it is saved (and
  // sent to the watch) even if the credentials are incomplete.
  if (data.action === 'save' && typeof data.touchDisabled === 'boolean') {
    saveTouchDisabled(data.touchDisabled);
    sendWatchSettings();
  }
  var email = String(data.email || '').trim();
  var typedPassword = String(data.password || '');
  var wantedListName = String(data.listName || '').trim();
  // An empty password field means "keep the saved password".
  var password = typedPassword || BringApi.loadState().password;
  if (!email || !password) {
    return;
  }

  if (data.action === 'test') {
    // Checks the entered values without storing them, then shows the result
    // on the settings page with the values still filled in.
    BringApi.checkAccount(email, password, wantedListName, function (result) {
      var check = checkRecord(result, email, wantedListName, true);
      BringApi.saveLastCheck(check);
      openSettings({ email: email, password: typedPassword, listName: wantedListName,
                     touchDisabled: !!data.touchDisabled }, check);
    });
    return;
  }

  // Save: store first, so the settings are kept whatever happens next.
  BringApi.saveCredentials(email, password, wantedListName);
  checkSavedSettings(function (result) {
    if (!result.ok) {
      // Reaches the watch if it happens to be open right now; otherwise the
      // next sync checks again and reports it.
      sendError(errorCodeFor(result), result.reason === 'list_not_found' ? wantedListName : '');
      return;
    }
    doSync();
  });
});
