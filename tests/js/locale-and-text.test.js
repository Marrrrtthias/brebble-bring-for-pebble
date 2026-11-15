// Unit tests for src/pkjs/locale.js and src/pkjs/text.js (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var Locale = require('../../src/pkjs/locale');
var truncateText = require('../../src/pkjs/text').truncateText;

test('languageCode handles both separators and case', function () {
  assert.strictEqual(Locale.languageCode('de-DE'), 'de');
  assert.strictEqual(Locale.languageCode('pt_BR'), 'pt');
  assert.strictEqual(Locale.languageCode('FR'), 'fr');
  assert.strictEqual(Locale.languageCode(''), '');
  assert.strictEqual(Locale.languageCode(null), '');
});

test('pickSupported returns the first supported language, else the fallback', function () {
  var table = { en: 1, de: 1 };
  assert.strictEqual(Locale.pickSupported(['nl_NL', 'de-AT'], table, 'en'), 'de');
  assert.strictEqual(Locale.pickSupported(['nl_NL', ''], table, 'en'), 'en');
  assert.strictEqual(Locale.pickSupported([undefined], table, null), null);
  // Inherited object properties must not count as supported languages.
  assert.strictEqual(Locale.pickSupported(['to'], table, 'en'), 'en');
});

test('truncateText leaves short text alone', function () {
  assert.strictEqual(truncateText('Wocheneinkauf', 40), 'Wocheneinkauf');
  assert.strictEqual(truncateText('x'.repeat(40), 40), 'x'.repeat(40));
});

test('truncateText cuts long text and marks the cut', function () {
  assert.strictEqual(truncateText('x'.repeat(50), 40), 'x'.repeat(40) + '…');
});

test('truncateText never leaves half of a surrogate pair', function () {
  var name = 'a'.repeat(39) + '🛒xyz'; // the emoji straddles the cut
  var result = truncateText(name, 40);
  assert.strictEqual(result, 'a'.repeat(39) + '…');
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result), 'no lone high surrogate');

  var kept = truncateText('a'.repeat(38) + '🛒xyz', 40); // the emoji fits entirely
  assert.strictEqual(kept, 'a'.repeat(38) + '🛒…');
});

test('a truncated list name fits the watch message buffer', function () {
  // Worst case: 3 UTF-8 bytes per UTF-16 unit. The watch buffer is 256 bytes
  // and the longest localized template is checked in tests/c/test_strings.c.
  var worst = truncateText('€'.repeat(100), 40);
  assert.ok(Buffer.byteLength(worst, 'utf8') <= 123);
});
