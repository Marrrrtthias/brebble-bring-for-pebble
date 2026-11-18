// Offline stand-in for src/pkjs/bring-api.js, used ONLY when taking store
// screenshots (see take_screenshots.sh). It makes the app look configured and
// serves a fixed demo shopping list, so no Bring! account or network is needed.
var BRING_DEFAULT_LOCALE = 'en-US';

var PURCHASE = ['Milk', 'Bread', 'Tomatoes', 'Chicken breast', 'Apple juice', 'Dish soap', 'Cheese', 'Bananas'];
var RECENTLY = ['Eggs', 'Butter'];

function loadState() {
  return { email: 'demo@example.com', password: 'demo', listUuid: 'demo', listName: 'Groceries', locale: 'en-US' };
}

function ensureAuth(cb) { cb(null, loadState()); }

function getListItems(state, cb) {
  cb(null, {
    purchase: PURCHASE.map(function (n) { return { itemId: n }; }),
    recently: RECENTLY.map(function (n) { return { itemId: n }; })
  });
}

function updateItem(state, name, op, cb) { cb(null); }
function noop() {}

module.exports = {
  BRING_DEFAULT_LOCALE: BRING_DEFAULT_LOCALE,
  loadState: loadState,
  saveState: noop,
  loadWantedListName: function () { return 'Groceries'; },
  saveCredentials: noop,
  saveLastCheck: noop,
  loadLastCheck: function () { return null; },
  isLoginRejected: function () { return false; },
  checkAccount: function (e, p, l, cb) {
    cb({ ok: true, lists: ['Groceries'], listName: 'Groceries', state: loadState() });
  },
  ensureAuth: ensureAuth,
  getListItems: getListItems,
  updateItem: updateItem
};
