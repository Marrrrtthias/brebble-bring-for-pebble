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
  var url = Config.buildSettingsUrl(current);
  assert.ok(url.indexOf('data:text/html;charset=utf-8,') === 0);
  return decodeURIComponent(url.substring(url.indexOf(',') + 1));
}

function titleOf(current) {
  return pageOf(current).match(/<title>(.*?)<\/title>/)[1];
}

test('config page uses the watch language first', function () {
  setPhoneLanguage('fr-FR');
  assert.strictEqual(titleOf({ locale: 'de_DE' }), 'Brebble-Einstellungen');
});

test('config page falls back to the phone language, then English', function () {
  setPhoneLanguage('fr-FR');
  assert.strictEqual(titleOf({ locale: '' }), 'Paramètres Brebble');
  assert.strictEqual(titleOf({ locale: 'nl_NL' }), 'Paramètres Brebble');
  setPhoneLanguage('nl');
  assert.strictEqual(titleOf({}), 'Brebble settings');
});

test('config page sets the html lang attribute', function () {
  setPhoneLanguage('en-US');
  assert.ok(pageOf({ locale: 'it_IT' }).indexOf('<html lang="it">') >= 0);
});

test('config page escapes stored values', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ email: 'a"b@example.com', listName: '<script>' });
  assert.ok(page.indexOf('value="a&quot;b@example.com"') >= 0);
  assert.ok(page.indexOf('value="&lt;script&gt;"') >= 0);
});

test('every language has every text', function () {
  var keys = Object.keys(Config.TEXTS.en).sort();
  Object.keys(Config.TEXTS).forEach(function (lang) {
    assert.deepStrictEqual(Object.keys(Config.TEXTS[lang]).sort(), keys, lang);
  });
});

test('saved password is never put into the page, only a hint that one exists', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ email: 'a@example.com', hasPassword: true });
  assert.ok(page.indexOf('var HAS_PASSWORD = true;') >= 0);
  assert.ok(page.indexOf('placeholder="Saved (leave empty to keep it)"') >= 0);
  assert.ok(/id="password" type="password" autocomplete="current-password" value=""/.test(page));
});

test('a typed password is kept when the page reopens after a test', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ email: 'a@example.com', password: 'p"w', hasPassword: false });
  assert.ok(page.indexOf('value="p&quot;w"') >= 0);
  assert.ok(page.indexOf('var HAS_PASSWORD = false;') >= 0);
});

test('a successful test shows the list and that it is not saved yet', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ check: { ok: true, test: true, email: 'a@example.com', listName: 'Home', lists: ['Home', 'Work'] } });
  assert.ok(page.indexOf('class="status ok"') >= 0);
  assert.ok(page.indexOf('Connected to the list “Home”.') >= 0);
  assert.ok(page.indexOf('Not saved yet') >= 0);
  assert.ok(page.indexOf('data-list="Work"') >= 0);
});

test('failed checks explain the problem', function () {
  setPhoneLanguage('en-US');
  assert.ok(pageOf({ check: { ok: false, reason: 'login' } }).indexOf('did not accept this email and password') >= 0);
  assert.ok(pageOf({ check: { ok: false, reason: 'connect' } }).indexOf('Could not reach Bring!') >= 0);
  var notFound = pageOf({ check: { ok: false, reason: 'list_not_found', wantedListName: '<x>', lists: ['Home'] } });
  assert.ok(notFound.indexOf('no list named “&lt;x&gt;”') >= 0);
  assert.ok(notFound.indexOf('data-list="Home"') >= 0);
  assert.ok(pageOf({}).indexOf('class="status') < 0);
});

test('page script is valid JavaScript', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ hasPassword: true });
  var script = page.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotThrow(function () { new Function(script); });
});

test('parseConfigResponse accepts encoded and plain JSON', function () {
  var data = { action: 'test', email: 'x@example.com', password: 'p', listName: '' };
  assert.deepStrictEqual(Config.parseConfigResponse(encodeURIComponent(JSON.stringify(data))), data);
  assert.deepStrictEqual(Config.parseConfigResponse(JSON.stringify(data)), data);
  assert.strictEqual(Config.parseConfigResponse('not json'), null);
});

test('disable-touch checkbox reflects the saved setting and is sent back', function () {
  setPhoneLanguage('en-US');
  var off = pageOf({});
  assert.ok(off.indexOf('<input id="touchDisabled" type="checkbox"> Disable touch') >= 0);
  var on = pageOf({ touchDisabled: true });
  assert.ok(on.indexOf('<input id="touchDisabled" type="checkbox" checked> Disable touch') >= 0);
  assert.ok(on.indexOf('touchDisabled: $("touchDisabled").checked') >= 0);
});

test('sort order card lists the sections in the given order and sends them back', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ sectionOrder: ['Tierbedarf'] });
  var rows = page.match(/<ul id="order" class="order">([\s\S]*?)<\/ul>/)[1];
  var sections = rows.match(/data-section="[^"]*"/g);
  assert.strictEqual(sections.length, 14);
  assert.strictEqual(sections[0], 'data-section="Tierbedarf"');
  assert.strictEqual(sections[1], 'data-section="Früchte &amp; Gemüse"');
  assert.ok(rows.indexOf('<span>Pet Supplies</span>') >= 0);
  assert.ok(page.indexOf('sectionOrder: sectionOrder()') >= 0);
  // The reset button restores Bring!'s order.
  var defaults = JSON.parse(page.match(/var DEFAULT_ORDER_HTML = (".*?");/)[1]);
  assert.strictEqual(defaults.match(/data-section="[^"]*"/)[0], 'data-section="Früchte &amp; Gemüse"');
});

test('sort order card defaults to the Bring! order', function () {
  setPhoneLanguage('en-US');
  var page = pageOf({ locale: 'de_DE' });
  var rows = page.match(/<ul id="order" class="order">([\s\S]*?)<\/ul>/)[1];
  assert.strictEqual(rows.match(/<span>([^<]*)<\/span>/)[1], 'Obst &amp; Gemüse');
});
