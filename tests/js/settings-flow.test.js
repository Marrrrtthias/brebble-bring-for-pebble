// End-to-end tests of the settings flow in src/pkjs/index.js, with a fake
// Pebble runtime and a fake Bring! server (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');

var server; // { login: status, lists: [...] } controls the fake Bring! answers
var opened; // URLs passed to Pebble.openURL
var sent;   // AppMessages sent to the watch
var listeners;

function FakeXHR() { this.headers = {}; }
FakeXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
FakeXHR.prototype.setRequestHeader = function () {};
FakeXHR.prototype.send = function () {
  var xhr = this;
  setImmediate(function () {
    var status = 200;
    var body = '';
    if (/bringauth$/.test(xhr.url)) {
      status = server.login;
      body = JSON.stringify({ uuid: 'u', publicUuid: 'p', access_token: 'tok', refresh_token: 'r',
        token_type: 'Bearer', expires_in: 3600, bringListUUID: 'l1' });
    } else if (/\/lists$/.test(xhr.url)) {
      body = JSON.stringify({ lists: server.lists });
    } else if (/v2\/bringusers\//.test(xhr.url)) {
      body = JSON.stringify({ userLocale: { language: 'en', country: 'US' } });
    } else if (/v2\/bringlists\//.test(xhr.url)) {
      body = JSON.stringify({ items: server.items });
    }
    if (status === 0) { xhr.onerror(); return; }
    xhr.status = status;
    xhr.responseText = status < 300 ? body : '';
    xhr.onload();
  });
};

function setup() {
  var store = {};
  globalThis.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  globalThis.XMLHttpRequest = FakeXHR;
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true, writable: true });
  server = { login: 200, lists: [{ listUuid: 'l1', name: 'Home' }, { listUuid: 'l2', name: 'Work' }],
    items: { purchase: [{ itemId: 'Milk' }], recently: [] } };
  opened = [];
  sent = [];
  listeners = {};
  globalThis.Pebble = {
    addEventListener: function (name, fn) { listeners[name] = fn; },
    openURL: function (url) { opened.push(decodeURIComponent(url.substring(url.indexOf(',') + 1))); },
    sendAppMessage: function (msg, ok) { sent.push(msg); if (ok) { setImmediate(ok); } },
    getActiveWatchInfo: function () { return { language: 'en_US' }; }
  };
  Object.keys(require.cache).forEach(function (k) {
    if (k.indexOf(path.join('src', 'pkjs')) >= 0) { delete require.cache[k]; }
  });
  require('../../src/pkjs/index.js');
}

function closeSettings(payload) {
  listeners.webviewclosed({ response: encodeURIComponent(JSON.stringify(payload)) });
}

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

test('saving keeps the credentials when Bring! cannot be reached', async function () {
  setup();
  server.login = 0;
  closeSettings({ action: 'save', email: 'a@example.com', password: 'secret', listName: '' });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_email'), 'a@example.com');
  assert.strictEqual(localStorage.getItem('bring_password'), 'secret');
  assert.strictEqual(sent[sent.length - 1].errorCode, 1); // ERR_CONNECT_BRING

  // Once Bring! is reachable again, the next sync resolves the list by itself.
  server.login = 200;
  sent = [];
  listeners.appmessage({ payload: { action: 0 } });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_listUuid'), 'l1');
  assert.ok(sent.some(function (m) { return m.action === 1 && m.itemName === 'Milk'; }));
});

test('saving keeps the credentials when the login is rejected', async function () {
  setup();
  server.login = 401;
  closeSettings({ action: 'save', email: 'a@example.com', password: 'wrong', listName: '' });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_password'), 'wrong');
  assert.strictEqual(sent[sent.length - 1].errorCode, 3); // ERR_LOGIN

  // The settings page shows the saved email and the failed check.
  listeners.showConfiguration();
  assert.ok(opened[0].indexOf('value="a@example.com"') >= 0);
  assert.ok(opened[0].indexOf('did not accept this email and password') >= 0);
});

test('a failed sync never removes the credentials', async function () {
  setup();
  closeSettings({ action: 'save', email: 'a@example.com', password: 'secret', listName: 'Work' });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_listUuid'), 'l2');
  localStorage.setItem('bring_expiresAt', '0'); // force a new login
  localStorage.removeItem('bring_refreshToken');
  server.login = 500;
  listeners.appmessage({ payload: { action: 0 } });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_email'), 'a@example.com');
  assert.strictEqual(localStorage.getItem('bring_password'), 'secret');
  assert.strictEqual(localStorage.getItem('bring_listUuid'), 'l2');
});

test('an empty password keeps the saved one', async function () {
  setup();
  closeSettings({ action: 'save', email: 'a@example.com', password: 'secret', listName: '' });
  await settle();
  closeSettings({ action: 'save', email: 'a@example.com', password: '', listName: 'Work' });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_password'), 'secret');
  assert.strictEqual(localStorage.getItem('bring_listUuid'), 'l2');
});

test('testing stores nothing and reopens the page with the result', async function () {
  setup();
  closeSettings({ action: 'save', email: 'a@example.com', password: 'secret', listName: '' });
  await settle();
  closeSettings({ action: 'test', email: 'b@example.com', password: 'new', listName: 'Nope' });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_email'), 'a@example.com');
  assert.strictEqual(localStorage.getItem('bring_password'), 'secret');
  assert.strictEqual(localStorage.getItem('bring_listUuid'), 'l1');
  assert.strictEqual(opened.length, 1);
  var page = opened[0];
  assert.ok(page.indexOf('value="b@example.com"') >= 0);
  assert.ok(page.indexOf('value="new"') >= 0);
  assert.ok(page.indexOf('value="Nope"') >= 0);
  assert.ok(page.indexOf('no list named “Nope”') >= 0);
  assert.ok(page.indexOf('data-list="Work"') >= 0);
  assert.ok(page.indexOf('secret') < 0);
});

test('a repeated sync request (manual refresh on the watch) sends the current list again', async function () {
  setup();
  closeSettings({ action: 'save', email: 'a@example.com', password: 'secret', listName: '' });
  await settle();

  // The list changed on another device since the last sync.
  server.items = { purchase: [{ itemId: 'Eggs' }], recently: [{ itemId: 'Milk' }] };
  sent = [];
  listeners.appmessage({ payload: { action: 0 } }); // ACTION_REQUEST_SYNC
  await settle();

  // Messages without an action carry watch settings (touchDisabled).
  var actions = sent.filter(function (m) { return 'action' in m; }).map(function (m) { return m.action; });
  assert.deepStrictEqual(actions, [7, 1, 1, 2]); // SYNC_START, two items, SYNC_DONE
  assert.deepStrictEqual(sent.filter(function (m) { return m.action === 1; }).map(function (m) {
    return [m.itemIndex, m.itemName, m.itemDone];
  }), [[0, 'Eggs', 0], [1, 'Milk', 1]]);
});

function touchMessages() {
  return sent.filter(function (m) { return 'touchDisabled' in m; });
}

test('the disable-touch setting is saved and sent to the watch', async function () {
  setup();
  closeSettings({ action: 'save', email: 'a@example.com', password: 'secret', listName: '', touchDisabled: true });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_touchDisabled'), '1');
  assert.deepStrictEqual(touchMessages(), [{ touchDisabled: 1 }]);
  assert.strictEqual(localStorage.getItem('bring_password'), 'secret');

  // The settings page shows it again.
  listeners.showConfiguration();
  assert.ok(opened[0].indexOf('id="touchDisabled" type="checkbox" checked') >= 0);

  // Every sync request from the watch also gets the current setting.
  sent = [];
  listeners.appmessage({ payload: { action: 0 } });
  await settle();
  assert.deepStrictEqual(touchMessages(), [{ touchDisabled: 1 }]);

  // Turning it back on keeps the saved password.
  sent = [];
  closeSettings({ action: 'save', email: 'a@example.com', password: '', listName: '', touchDisabled: false });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_touchDisabled'), '0');
  assert.deepStrictEqual(touchMessages(), [{ touchDisabled: 0 }]);
  assert.strictEqual(localStorage.getItem('bring_password'), 'secret');
});

test('touch stays on by default, and a test does not save the setting', async function () {
  setup();
  sent = [];
  listeners.appmessage({ payload: { action: 0 } });
  await settle();
  assert.deepStrictEqual(touchMessages(), [{ touchDisabled: 0 }]);

  closeSettings({ action: 'test', email: 'a@example.com', password: 'secret', listName: '', touchDisabled: true });
  await settle();
  assert.strictEqual(localStorage.getItem('bring_touchDisabled'), null);
  // The reopened page keeps the box ticked.
  assert.ok(opened[0].indexOf('id="touchDisabled" type="checkbox" checked') >= 0);
});
