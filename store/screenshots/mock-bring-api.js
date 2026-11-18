// Offline stand-in for src/pkjs/bring-api.js, used ONLY when taking store
// screenshots (see take_screenshots.sh). It makes the app look configured and
// serves a fixed demo shopping list, so no Bring! account or network is needed.
var BRING_DEFAULT_LOCALE = 'en-US';

// [name, details, Bring! section (picks the icon, see src/pkjs/categorize.js)]
var PURCHASE = [
  ['Milk', '2 l, lactose-free', 'Milch & Käse'],
  ['Bread', '', 'Brot & Gebäck'],
  ['Tomatoes', '500 g', 'Früchte & Gemüse'],
  // Highlighted in the second screenshot; round watches show details only
  // on the highlighted item.
  ['Chicken breast', '400 g', 'Fleisch & Fisch'],
  ['Apple juice', '1 l', 'Getränke & Tabak'],
  ['Dish soap', '', 'Haushalt & Gesundheit'],
  ['Cheese', 'Gouda', 'Milch & Käse'],
  ['Bananas', '', 'Früchte & Gemüse']
];
var RECENTLY = [['Eggs', '10', 'Milch & Käse'], ['Butter', '', 'Milch & Käse']];

function toEntries(items) {
  return items.map(function (i) { return { itemId: i[0], specification: i[1], sectionId: i[2] }; });
}

function loadState() {
  return { email: 'demo@example.com', password: 'demo', listUuid: 'demo', listName: 'Groceries', locale: 'en-US' };
}

function ensureAuth(cb) { cb(null, loadState()); }

function getListItems(state, cb) {
  cb(null, {
    purchase: toEntries(PURCHASE),
    recently: toEntries(RECENTLY)
  });
}

function updateItem(state, name, op, spec, cb) { cb(null); }
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
