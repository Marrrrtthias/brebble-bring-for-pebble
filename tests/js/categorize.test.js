// Unit tests for src/pkjs/categorize.js (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var categorize = require('../../src/pkjs/categorize').categorize;

var DEFAULT = 0, BREAD = 1, DAIRY = 2, FRUIT = 3, VEGETABLE = 4, MEAT = 5, DRINK = 6, CLEANING = 7;

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

test('languages without keywords and missing locales give the default icon', function () {
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
