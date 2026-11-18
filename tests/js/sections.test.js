// Unit tests for the item section lookup in src/pkjs/bring-api.js (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var BringApi = require('../../src/pkjs/bring-api');

// Shape of https://web.getbring.com/locale/catalog.<locale>.json
var CATALOG = {
  language: 'en-US',
  catalog: {
    sections: [
      { sectionId: 'Früchte & Gemüse', name: 'Fruits & Vegetables',
        items: [{ itemId: 'Äpfel', name: 'Apples' }, { itemId: 'Tomaten', name: 'Tomatoes' }] },
      { sectionId: 'Tierbedarf', name: 'Pet Supplies',
        items: [{ itemId: 'Hundefutter', name: 'Dog Food' }] },
      { sectionId: 'Leer', name: 'Empty' }
    ]
  }
};

test('catalogSections maps canonical item ids to section ids', function () {
  assert.deepStrictEqual(BringApi.catalogSections(CATALOG), {
    'Äpfel': 'Früchte & Gemüse',
    'Tomaten': 'Früchte & Gemüse',
    'Hundefutter': 'Tierbedarf'
  });
  assert.deepStrictEqual(BringApi.catalogSections(null), {});
  assert.deepStrictEqual(BringApi.catalogSections({}), {});
});

test('assignSections prefers the user-assigned section over the catalog', function () {
  var catalog = BringApi.catalogSections(CATALOG);
  var user = { 'Tomaten': 'Zutaten & Gewürze', 'Medialunas': 'Brot & Gebäck' };
  var list = [
    { itemId: 'Äpfel' },
    { itemId: 'Tomaten' },
    { itemId: 'Medialunas' },
    { itemId: 'Something typed' },
    null
  ];
  BringApi.assignSections(list, user, catalog);
  assert.deepStrictEqual(list.slice(0, 4).map(function (i) { return i.sectionId; }), [
    'Früchte & Gemüse', 'Zutaten & Gewürze', 'Brot & Gebäck', null
  ]);
});

test('assignSections ignores inherited object keys', function () {
  var list = [{ itemId: 'constructor' }, { itemId: 'toString' }, { itemId: 'hasOwnProperty' }];
  BringApi.assignSections(list, { hasOwnProperty: 'Tierbedarf' }, {});
  assert.strictEqual(list[0].sectionId, null);
  assert.strictEqual(list[1].sectionId, null);
  assert.strictEqual(list[2].sectionId, 'Tierbedarf');
});
