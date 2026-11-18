// Unit tests for src/pkjs/categorize.js (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var Categorize = require('../../src/pkjs/categorize');
var categorize = Categorize.guessSection;

// Keyword guesses give Bring! section ids (null = no match).
var DEFAULT = null;
var BREAD = 'Brot & Gebäck', DAIRY = 'Milch & Käse', FRUIT = 'Früchte & Gemüse',
  VEGETABLE = 'Früchte & Gemüse', MEAT = 'Fleisch & Fisch', DRINK = 'Getränke & Tabak',
  CLEANING = 'Haushalt & Gesundheit';

function check(cases) {
  cases.forEach(function (c) {
    assert.strictEqual(categorize(c[0], c[1]), c[2], c[0] + ' (' + c[1] + ')');
  });
}

test('English: whole words and plurals, no matches inside other words', function () {
  check([
    ['Tomatoes', 'en-US', VEGETABLE],
    ['Strawberries', 'en-GB', FRUIT],
    ['Whole milk', 'en-US', DAIRY],
    ['Tea', 'en-US', DRINK],
    ['Steak', 'en-US', MEAT], // not "tea"
    ['Peanutbutter', 'en-US', DEFAULT]
  ]);
});

test('Spanish: plurals including accented endings', function () {
  check([
    ['Limones', 'es-ES', FRUIT],
    ['Atunes', 'es-ES', MEAT],
    ['Papas fritas', 'es-ES', VEGETABLE],
    ['Pan integral', 'es-ES', BREAD],
    ['Té verde', 'es-ES', DRINK],
    ['Huevos', 'es-ES', MEAT],
    ['Pantalla', 'es-ES', DEFAULT] // not "pan"
  ]);
});

test('German: keywords match at the end of compound nouns', function () {
  check([
    ['Vollmilch', 'de-DE', DAIRY],
    ['Orangensaft', 'de-DE', DRINK],
    ['Vollkornbrot', 'de-DE', BREAD],
    ['Rotwein', 'de-DE', DRINK],
    ['Schwein', 'de-DE', MEAT], // longest keyword wins over "wein"
    ['Eier', 'de-DE', MEAT],
    ['Tee', 'de-DE', DRINK],
    ['Äpfel', 'de-DE', FRUIT],
    ['Kartoffelsalat', 'de-DE', DEFAULT] // keyword at the start, not the end
  ]);
});

test('German: ß does not split words', function () {
  check([
    ['Weißwein', 'de-DE', DRINK],
    ['Weißbrot', 'de-CH', BREAD],
    ['Weißei', 'de-DE', DEFAULT] // "ei" is too short for suffix matching
  ]);
});

test('French, Italian, Portuguese: whole words, plurals, phrases', function () {
  check([
    ['Laitue', 'fr-FR', DEFAULT], // not "lait"
    ['Pomme de terre', 'fr-FR', VEGETABLE], // phrase beats "pomme"
    ['Pommes de terre', 'fr-FR', VEGETABLE],
    ['Pommes', 'fr-FR', FRUIT],
    ['Oeufs', 'fr-FR', MEAT],
    ['Mele', 'it-IT', FRUIT],
    ['Patate', 'it-IT', VEGETABLE],
    ['Uova', 'it-IT', MEAT], // irregular plural
    ['Caramella', 'it-IT', DEFAULT], // not "mela"
    ['Maçãs', 'pt-BR', FRUIT],
    ['Pães de forma', 'pt-BR', BREAD], // irregular plural
    ['Sabões', 'pt-BR', CLEANING],
    ['Cervejas', 'pt-BR', DRINK]
  ]);
});

test('only the given language is used', function () {
  check([
    ['Milch', 'de-DE', DAIRY],
    ['Milch', 'en-US', DEFAULT],
    ['Milk', 'de-DE', DEFAULT]
  ]);
});

test('languages without keywords and missing locales give no section', function () {
  check([
    ['Melk', 'nl-NL', DEFAULT],
    ['Milk', 'nl-NL', DEFAULT],
    ['Milk', null, DEFAULT],
    ['Milk', '', DEFAULT],
    ['', 'en-US', DEFAULT],
    [null, 'en-US', DEFAULT]
  ]);
});

test('results are stable across repeated calls (cached keyword forms)', function () {
  for (var i = 0; i < 3; i++) {
    assert.strictEqual(categorize('Vollmilch', 'de-DE'), DAIRY);
    assert.strictEqual(categorize('Tomatoes', 'en-US'), VEGETABLE);
  }
});

// The 13 sections of Bring!'s catalog (catalog.<locale>.json, sectionId).
var BRING_SECTIONS = [
  'Früchte & Gemüse', 'Brot & Gebäck', 'Milch & Käse', 'Fleisch & Fisch',
  'Zutaten & Gewürze', 'Fertig- & Tiefkühlprodukte', 'Getreideprodukte',
  'Snacks & Süsswaren', 'Getränke & Tabak', 'Haushalt & Gesundheit',
  'Pflege & Gesundheit', 'Tierbedarf', 'Baumarkt & Garten'
];

test('every Bring! section has its own icon', function () {
  var seen = {};
  BRING_SECTIONS.forEach(function (section) {
    var icon = Categorize.iconFor({ name: 'x', sectionId: section }, 'en-US');
    assert.ok(icon > Categorize.ICON_DEFAULT, section);
    assert.ok(!seen[icon], section + ' shares icon ' + icon);
    seen[icon] = true;
  });
  assert.strictEqual(Object.keys(Categorize.SECTION_ICONS).length, BRING_SECTIONS.length);
});

test('the item section wins over the name', function () {
  // "Milk" sorted into household by the user: the section counts.
  assert.strictEqual(
    Categorize.iconFor({ name: 'Milk', sectionId: 'Haushalt & Gesundheit' }, 'en-US'),
    Categorize.SECTION_ICONS['Haushalt & Gesundheit']);
  // A catalog item whose translated name has no keyword still gets its icon.
  assert.strictEqual(
    Categorize.iconFor({ name: 'Dog food', sectionId: 'Tierbedarf' }, 'en-US'),
    Categorize.SECTION_ICONS['Tierbedarf']);
});

test('items without a known section fall back to the name guess, then the default', function () {
  assert.strictEqual(Categorize.iconFor({ name: 'Medialunas', sectionId: null }, 'es-ES'),
    Categorize.SECTION_ICONS['Brot & Gebäck']);
  // Unknown (e.g. user-defined) section ids are ignored.
  assert.strictEqual(Categorize.iconFor({ name: 'Leche', sectionId: 'Mi sección' }, 'es-ES'),
    Categorize.SECTION_ICONS['Milch & Käse']);
  assert.strictEqual(Categorize.iconFor({ name: 'Pilas' }, 'es-ES'), Categorize.ICON_DEFAULT);
  assert.strictEqual(Categorize.iconFor({ name: 'Pilas', sectionId: 'Mi sección' }, 'nl-NL'),
    Categorize.ICON_DEFAULT);
  assert.strictEqual(Categorize.iconFor(null, 'en-US'), Categorize.ICON_DEFAULT);
});

test('keyword sections are all known sections', function () {
  ['Bread', 'Milk', 'Apple', 'Tomato', 'Chicken', 'Beer', 'Soap'].forEach(function (name) {
    assert.ok(Categorize.isKnownSection(categorize(name, 'en-US')), name);
  });
});
