// Item details ("Milk" + "500 ml"): src/pkjs/index.js sends them to the watch
// and keeps them when an item is toggled (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var path = require('node:path');

var listItems; // { purchase: [...], recently: [...] } served by the fake Bring! server
var puts;      // parsed bodies of item updates sent to Bring!
var sent;      // AppMessages sent to the watch
var listeners;

function FakeXHR() {}
FakeXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
FakeXHR.prototype.setRequestHeader = function () {};
FakeXHR.prototype.send = function (body) {
  var xhr = this;
  setImmediate(function () {
    var response = '';
    if (xhr.method === 'PUT') {
      puts.push(JSON.parse(body));
    } else if (/v2\/bringusers\//.test(xhr.url)) {
      response = JSON.stringify({ userLocale: { language: 'de', country: 'CH' } }); // no translation needed
    } else if (/v2\/bringlists\//.test(xhr.url)) {
      response = JSON.stringify({ items: listItems });
    }
    xhr.status = 200;
    xhr.responseText = response;
    xhr.onload();
  });
};

function setup(items) {
  var store = {
    bring_email: 'a@example.com', bring_password: 'secret', bring_listUuid: 'l1',
    bring_uuid: 'u', bring_accessToken: 'tok', bring_expiresAt: String(Date.now() + 3600000),
    bring_locale: 'de-CH', bring_country: 'CH'
  };
  globalThis.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
  globalThis.XMLHttpRequest = FakeXHR;
  listItems = items;
  puts = [];
  sent = [];
  listeners = {};
  globalThis.Pebble = {
    addEventListener: function (name, fn) { listeners[name] = fn; },
    openURL: function () {},
    sendAppMessage: function (msg, ok) { sent.push(msg); if (ok) { setImmediate(ok); } }
  };
  Object.keys(require.cache).forEach(function (k) {
    if (k.indexOf(path.join('src', 'pkjs')) >= 0) { delete require.cache[k]; }
  });
  require('../../src/pkjs/index.js');
}

function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

function syncedItems() {
  return sent.filter(function (m) { return m.action === 1; });
}

async function sync() {
  sent = [];
  listeners.appmessage({ payload: { action: 0 } });
  await settle();
}

test('item details are sent to the watch as itemDetail', async function () {
  setup({
    purchase: [{ itemId: 'Milch', specification: '500 ml' }, { itemId: 'Brot', specification: '' }, { itemId: 'Käse' }],
    recently: [{ itemId: 'Eier', specification: '10' }]
  });
  await sync();
  var items = syncedItems();
  assert.deepStrictEqual(items.map(function (m) { return [m.itemName, m.itemDetail, m.itemDone]; }), [
    ['Milch', '500 ml', 0],
    ['Brot', undefined, 0],
    ['Käse', undefined, 0],
    ['Eier', '10', 1]
  ]);
  // Items without details carry no itemDetail key at all, to keep messages small.
  assert.ok(!('itemDetail' in items[1]));
});

test('item details are cleaned up and shortened for the watch', async function () {
  var long = 'Vollkorn, geschnitten, ungefähr 750 Gramm vom Bäcker';
  setup({
    purchase: [{ itemId: 'Milch', specification: '  2 l,\n laktosefrei ' }, { itemId: 'Brot', specification: long },
      { itemId: 'Salz', specification: '   ' }],
    recently: []
  });
  await sync();
  var items = syncedItems();
  assert.strictEqual(items[0].itemDetail, '2 l, laktosefrei');
  assert.strictEqual(items[1].itemDetail, long.substring(0, 36) + '…');
  assert.ok(!('itemDetail' in items[2]));
});

test('toggling an item on the watch keeps its details in Bring!', async function () {
  setup({ purchase: [{ itemId: 'Milch', specification: '500 ml' }, { itemId: 'Brot' }], recently: [] });
  await sync();
  listeners.appmessage({ payload: { action: 3, itemIndex: 0, itemName: 'Milch', itemDone: 1 } });
  await settle();
  listeners.appmessage({ payload: { action: 3, itemIndex: 1, itemName: 'Brot', itemDone: 1 } });
  await settle();
  assert.strictEqual(puts.length, 2);
  assert.deepStrictEqual(puts.map(function (p) { return [p.changes[0].itemId, p.changes[0].spec, p.changes[0].operation]; }), [
    ['Milch', '500 ml', 'TO_RECENTLY'],
    ['Brot', '', 'TO_RECENTLY']
  ]);
});

test('a toggle for an item the phone no longer has at that index sends no details', async function () {
  setup({ purchase: [{ itemId: 'Milch', specification: '500 ml' }], recently: [] });
  await sync();
  listeners.appmessage({ payload: { action: 3, itemIndex: 0, itemName: 'Brot', itemDone: 1 } });
  await settle();
  assert.strictEqual(puts[0].changes[0].spec, '');
});
