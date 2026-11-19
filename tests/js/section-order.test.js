// Unit tests for src/pkjs/sections.js: grouping the open items by section
// (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var Sections = require('../../src/pkjs/sections');
var Categorize = require('../../src/pkjs/categorize');
var Config = require('../../src/pkjs/config');

function item(name, sectionId, done) {
  return { name: name, sectionId: sectionId, done: !!done };
}

function names(items) {
  return items.map(function (i) { return i.name; });
}

test('the default order is the Bring! app order, own items last', function () {
  assert.strictEqual(Sections.DEFAULT_ORDER[0], 'Früchte & Gemüse');
  assert.strictEqual(Sections.DEFAULT_ORDER[Sections.DEFAULT_ORDER.length - 1], Sections.OWN_ITEMS);
  assert.deepStrictEqual(Sections.normalizeOrder(null), Sections.DEFAULT_ORDER);
});

test('every section with an icon has a place in the order', function () {
  Object.keys(Categorize.SECTION_ICONS).forEach(function (id) {
    assert.ok(Sections.DEFAULT_ORDER.indexOf(id) >= 0, id);
  });
  assert.strictEqual(Sections.DEFAULT_ORDER.length, Object.keys(Categorize.SECTION_ICONS).length + 1);
});

test('every settings language has a name for every section', function () {
  Object.keys(Config.TEXTS).forEach(function (lang) {
    assert.ok(Sections.NAMES[lang], lang);
    assert.strictEqual(Sections.NAMES[lang].length, Sections.DEFAULT_ORDER.length, lang);
  });
  assert.strictEqual(Sections.nameOf('Tierbedarf', 'en'), 'Pet Supplies');
  assert.strictEqual(Sections.nameOf('Früchte & Gemüse', 'de'), 'Obst & Gemüse');
  assert.strictEqual(Sections.nameOf('Tierbedarf', 'nl'), 'Pet Supplies');
});

test('normalizeOrder drops unknown and repeated entries and appends missing sections', function () {
  var order = Sections.normalizeOrder(['Tierbedarf', 'nope', 'Tierbedarf', Sections.OWN_ITEMS, 42]);
  assert.strictEqual(order.length, Sections.DEFAULT_ORDER.length);
  assert.deepStrictEqual(order.slice(0, 3), ['Tierbedarf', Sections.OWN_ITEMS, 'Früchte & Gemüse']);
  assert.deepStrictEqual(Sections.normalizeOrder('x'), Sections.DEFAULT_ORDER);
});

test('open items are grouped by section in Bring! order, keeping their order within a section', function () {
  var items = [
    item('Soap', 'Haushalt & Gesundheit'),
    item('Typed', null),
    item('Apples', 'Früchte & Gemüse'),
    item('Milk', 'Milch & Käse'),
    item('Tomatoes', 'Früchte & Gemüse'),
    item('Custom', 'Some custom section'),
    item('Bread', 'Brot & Gebäck')
  ];
  assert.deepStrictEqual(names(Sections.sortItems(items, null)),
    ['Apples', 'Tomatoes', 'Bread', 'Milk', 'Soap', 'Typed', 'Custom']);
});

test('completed items stay below the open ones, unsorted', function () {
  var items = [
    item('Soap', 'Haushalt & Gesundheit', true),
    item('Milk', 'Milch & Käse'),
    item('Apples', 'Früchte & Gemüse', true),
    item('Bread', 'Brot & Gebäck')
  ];
  assert.deepStrictEqual(names(Sections.sortItems(items, null)), ['Bread', 'Milk', 'Soap', 'Apples']);
});

test('a custom order is used, also for items without a section', function () {
  var items = [item('Apples', 'Früchte & Gemüse'), item('Typed', null), item('Dog food', 'Tierbedarf')];
  assert.deepStrictEqual(names(Sections.sortItems(items, [Sections.OWN_ITEMS, 'Tierbedarf'])),
    ['Typed', 'Dog food', 'Apples']);
});

test('the order is saved complete and survives broken storage', function () {
  var store = {};
  globalThis.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  };
  assert.deepStrictEqual(Sections.loadOrder(), Sections.DEFAULT_ORDER);
  Sections.saveOrder(['Tierbedarf']);
  assert.strictEqual(Sections.loadOrder()[0], 'Tierbedarf');
  assert.strictEqual(Sections.loadOrder().length, Sections.DEFAULT_ORDER.length);
  store.bring_sectionOrder = '{broken';
  assert.deepStrictEqual(Sections.loadOrder(), Sections.DEFAULT_ORDER);
});
