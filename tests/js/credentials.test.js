// Unit tests for credential storage and list selection in
// src/pkjs/bring-api.js (run with `npm test`). The saved credentials must
// survive anything except the user entering new ones.
var test = require('node:test');
var assert = require('node:assert');

function fakeLocalStorage() {
  var data = {};
  return {
    data: data,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

globalThis.localStorage = fakeLocalStorage();
var BringApi = require('../../src/pkjs/bring-api');

function reset(values) {
  globalThis.localStorage = fakeLocalStorage();
  Object.keys(values || {}).forEach(function (k) { localStorage.setItem(k, values[k]); });
}

var CONFIGURED = {
  bring_email: 'a@example.com',
  bring_password: 'secret',
  bring_wantedList: 'Home',
  bring_accessToken: 'token',
  bring_refreshToken: 'refresh',
  bring_uuid: 'user',
  bring_locale: 'de-DE',
  bring_country: 'DE',
  bring_listUuid: 'list-1',
  bring_listName: 'Home'
};

test('saving the same settings again keeps the session and list', function () {
  reset(CONFIGURED);
  BringApi.saveCredentials('A@example.com', 'secret', 'home');
  assert.strictEqual(localStorage.getItem('bring_accessToken'), 'token');
  assert.strictEqual(localStorage.getItem('bring_listUuid'), 'list-1');
});

test('changing the list name keeps the session but drops the resolved list', function () {
  reset(CONFIGURED);
  BringApi.saveCredentials('a@example.com', 'secret', 'Work');
  assert.strictEqual(localStorage.getItem('bring_accessToken'), 'token');
  assert.strictEqual(localStorage.getItem('bring_listUuid'), null);
  assert.strictEqual(BringApi.loadWantedListName(), 'Work');
});

test('changing the credentials drops the old session but stores the new credentials', function () {
  reset(CONFIGURED);
  BringApi.saveCredentials('b@example.com', 'other', 'Home');
  var s = BringApi.loadState();
  assert.strictEqual(s.email, 'b@example.com');
  assert.strictEqual(s.password, 'other');
  assert.strictEqual(s.accessToken, '');
  assert.strictEqual(s.locale, '');
  assert.strictEqual(s.listUuid, '');
});

test('credentials are stored even before they were checked', function () {
  reset({ bring_configError: '{"code":3}' });
  BringApi.saveCredentials('a@example.com', 'secret', '');
  assert.strictEqual(BringApi.loadState().email, 'a@example.com');
  assert.strictEqual(BringApi.loadState().password, 'secret');
  assert.strictEqual(localStorage.getItem('bring_configError'), null);
});

test('the wanted list falls back to the list name stored by older versions', function () {
  reset({ bring_listName: 'Old' });
  assert.strictEqual(BringApi.loadWantedListName(), 'Old');
  reset({ bring_listName: 'Old', bring_wantedList: '' });
  assert.strictEqual(BringApi.loadWantedListName(), '');
});

test('only 4xx answers count as rejected credentials', function () {
  assert.strictEqual(BringApi.isLoginRejected({ status: 401 }), true);
  assert.strictEqual(BringApi.isLoginRejected({ status: 0 }), false);
  assert.strictEqual(BringApi.isLoginRejected({ status: 503 }), false);
  assert.strictEqual(BringApi.isLoginRejected(null), false);
});

test('pickList finds a list by name or falls back to the default list', function () {
  var lists = [{ listUuid: '1', name: 'Home' }, { listUuid: '2', name: 'Work' }];
  assert.strictEqual(BringApi.pickList(lists, 'work', '1').listUuid, '2');
  assert.strictEqual(BringApi.pickList(lists, 'Nope', '1'), null);
  assert.strictEqual(BringApi.pickList(lists, '', '2').listUuid, '2');
  assert.strictEqual(BringApi.pickList(lists, '', 'gone').listUuid, '1');
  assert.strictEqual(BringApi.pickList([], '', ''), null);
});

test('last check survives a round trip and tolerates garbage', function () {
  reset();
  BringApi.saveLastCheck({ ok: true, listName: 'Home' });
  assert.deepStrictEqual(BringApi.loadLastCheck(), { ok: true, listName: 'Home' });
  localStorage.setItem('bring_lastCheck', '{broken');
  assert.strictEqual(BringApi.loadLastCheck(), null);
});
