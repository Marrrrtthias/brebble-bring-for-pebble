#pragma once

// Localized UI text. One table per language lives in strings.c; the language
// is chosen from the watch's system locale and falls back to English.
// The phone side sends error *codes* (not text) so errors are shown in the
// watch's language too.

typedef struct {
  const char *lang;            // two-letter language code
  const char *add_item;
  const char *add_item_hint;
  const char *list_header;
  const char *loading;
  const char *not_configured;
  const char *err_phone;
  const char *err_generic;
  const char *err_connect;
  const char *err_read;
  const char *err_login;
  const char *err_no_lists;
  const char *err_list_not_found; // contains one %s for the list name
  const char *err_permission;
} Strings;

// Returns the strings for a locale such as "de_DE" (NULL or unknown
// languages give English). Never returns NULL.
const Strings *strings_for_locale(const char *locale);
