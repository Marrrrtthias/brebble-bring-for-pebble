// Unit tests for src/pkjs/config.js (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var Config = require('../../src/pkjs/config');

// Node has a built-in `navigator` that plain assignment cannot replace.
function setPhoneLanguage(language) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: language }, configurable: true, writable: true
  });
}

function pageOf(current) {
  var url = Config.buildCredentialsUrl(current);
  assert.ok(url.indexOf('data:text/html;charset=utf-8,') === 0);
  return decodeURIComponent(url.substring(url.indexOf(',') + 1));
}

function titleOf(current) {
  return pageOf(current).match(/<title>(.*?)<\/title>/)[1];
}

test('config page uses the watch language first', function () {
  setPhoneLanguage('fr-FR');
  assert.strictEqual(titleOf({ locale: 'de_DE' }), 'Bring!-Konto verbinden');
});

test('config page falls back to the phone language, then English', function () {
  setPhoneLanguage('fr-FR');
  assert.strictEqual(titleOf({ locale: '' }), 'Connectez votre compte Bring!');
  assert.strictEqual(titleOf({ locale: 'nl_NL' }), 'Connectez votre compte Bring!');
  setPhoneLanguage('nl');
  assert.strictEqual(titleOf({}), 'Connect your Bring! account');
});

test('config page sets the html lang attribute', function () {
  setPhoneLanguage('en-US');
  assert.ok(pageOf({ locale: 'it_IT' }).indexOf('<html lang="it">') >= 0);
});

test('config page escapes stored values', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ email: 'a"b@example.com', listName: '<script>' });
  assert.ok(page.indexOf('value="a&quot;b@example.com"') >= 0);
  assert.ok(page.indexOf('value="&lt;script>"') >= 0);
});

test('parseConfigResponse accepts encoded and plain JSON', function () {
  var data = { email: 'x@example.com', password: 'p', listName: '' };
  assert.deepStrictEqual(Config.parseConfigResponse(encodeURIComponent(JSON.stringify(data))), data);
  assert.deepStrictEqual(Config.parseConfigResponse(JSON.stringify(data)), data);
  assert.strictEqual(Config.parseConfigResponse('not json'), null);
});
