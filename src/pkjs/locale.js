// Shared locale parsing for the phone side. The watch has its own copy in
// src/c/strings.c (strings_for_locale), since C and JS can't share code.

// "de-DE" / "de_DE" / "DE" -> "de"; "" when missing.
function languageCode(locale) {
  return String(locale || '').substring(0, 2).toLowerCase();
}

// The first of `locales` whose language has an entry in `table`, else
// `fallback`.
function pickSupported(locales, table, fallback) {
  for (var i = 0; i < locales.length; i++) {
    var code = languageCode(locales[i]);
    if (code && table.hasOwnProperty(code)) {
      return code;
    }
  }
  return fallback;
}

module.exports = {
  languageCode: languageCode,
  pickSupported: pickSupported
};
