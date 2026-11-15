// Host-side tests for the watch's string tables (src/c/strings.c).
// Build and run: npm run test:c
#include <stdio.h>
#include <string.h>
#include "../../src/c/strings.h"

// Must match s_message_text in src/c/bring_pebble.c.
#define MESSAGE_BUFFER_SIZE 256
// Worst-case UTF-8 size of a list name capped by MAX_ERROR_DETAIL in
// src/pkjs/index.js (40 units * 3 bytes, plus the 3-byte ellipsis).
#define MAX_DETAIL_BYTES 123

static const char *LANGUAGES[] = { "en", "es", "de", "fr", "it", "pt" };
#define LANGUAGE_COUNT (sizeof(LANGUAGES) / sizeof(LANGUAGES[0]))

static int s_failures = 0;

#define CHECK(cond, ...) do { \
  if (!(cond)) { s_failures++; printf("FAIL %s:%d: ", __FILE__, __LINE__); printf(__VA_ARGS__); printf("\n"); } \
} while (0)

// Counts printf conversions; "%%" is a literal percent sign, not a conversion.
static int count_conversions(const char *text, int *string_conversions) {
  int count = 0;
  *string_conversions = 0;
  for (const char *p = text; *p; p++) {
    if (*p != '%') continue;
    if (p[1] == '%') { p++; continue; }
    count++;
    if (p[1] == 's') (*string_conversions)++;
  }
  return count;
}

static void test_language_lookup(void) {
  for (size_t i = 0; i < LANGUAGE_COUNT; i++) {
    char locale[8];
    snprintf(locale, sizeof(locale), "%s_XX", LANGUAGES[i]);
    CHECK(strcmp(strings_for_locale(locale)->lang, LANGUAGES[i]) == 0, "locale %s", locale);
  }
  CHECK(strcmp(strings_for_locale("de")->lang, "de") == 0, "bare language code");
  CHECK(strcmp(strings_for_locale("nl_NL")->lang, "en") == 0, "unknown language falls back to English");
  CHECK(strcmp(strings_for_locale(NULL)->lang, "en") == 0, "NULL falls back to English");
  CHECK(strcmp(strings_for_locale("")->lang, "en") == 0, "empty falls back to English");
}

static void test_tables(void) {
  for (size_t i = 0; i < LANGUAGE_COUNT; i++) {
    const Strings *s = strings_for_locale(LANGUAGES[i]);
    // Every field is a const char *; walk them all.
    const char *const *fields = (const char *const *)s;
    size_t field_count = sizeof(Strings) / sizeof(const char *);
    for (size_t f = 0; f < field_count; f++) {
      CHECK(fields[f] != NULL && fields[f][0] != '\0', "%s: field %zu is empty", LANGUAGES[i], f);
      if (fields[f] == NULL) continue;
      CHECK(strlen(fields[f]) < MESSAGE_BUFFER_SIZE, "%s: field %zu too long", LANGUAGES[i], f);
      int strings = 0;
      int conversions = count_conversions(fields[f], &strings);
      if (fields[f] == s->err_list_not_found) {
        // Passed to snprintf with exactly one string argument.
        CHECK(conversions == 1 && strings == 1, "%s: err_list_not_found needs exactly one %%s", LANGUAGES[i]);
      } else {
        // Shown as plain text; a stray % would only matter if it ever became a format.
        CHECK(conversions == 0, "%s: field %zu has a format conversion", LANGUAGES[i], f);
      }
    }
    // The list-not-found message must fit with the longest list name the phone sends.
    size_t template_bytes = strlen(s->err_list_not_found) - 2; // without "%s"
    CHECK(template_bytes + MAX_DETAIL_BYTES < MESSAGE_BUFFER_SIZE,
          "%s: list-not-found message (%zu bytes) may not fit", LANGUAGES[i], template_bytes);
  }
}

int main(void) {
  test_language_lookup();
  test_tables();
  if (s_failures) {
    printf("%d check(s) failed\n", s_failures);
    return 1;
  }
  printf("strings: all checks passed\n");
  return 0;
}
