// Picks the icon for an item on the watch's list rows from its Bring! section
// ("category"). Bring! files every catalog item under one of a fixed set of
// sections, identified by their German names ('Früchte & Gemüse', ...), the
// same ids in every locale. bring-api.js resolves an item's section from:
//   1. the section the user assigned to it in this list (list details),
//   2. the section of the catalog item (catalog.<locale>.json),
// and passes it in as item.sectionId. Each section has its own icon.
//
// Items Bring! knows no section for (free-typed items the user never sorted
// into a section, or when the catalog couldn't be loaded) fall back to a
// best-effort guess from the item's name (guessSection), and to the default
// icon when that finds nothing either.
//
// The guess only uses the keywords of the language the item names are in
// (the caller passes that locale; see languageOf()): short words from other
// languages cause false positives ('lait' vs. the French 'laitue'). For a
// language without a keyword table nothing is matched. How a keyword is
// matched depends on the language:
//   'plural': whole word or phrase, also in the language's common plural
//             forms ('tomato' matches 'tomatoes', 'limón' matches 'limones').
//             Never matches inside another word ('tea' does not hit 'steak').
//   'suffix': German builds compound nouns whose head noun comes last
//             ('Vollmilch', 'Kartoffelsalat'), so a keyword also matches at
//             the end of a word (keywords under 3 letters must match whole).
// Across all sections the longest matching keyword wins, so "pomme de
// terre" (potato) beats "pomme" (apple) and "schwein" beats "wein".

var Locale = require('./locale');

// Icon ids sent to the watch. Must match the order of CATEGORY_RESOURCE_IDS
// in src/c/bring_pebble.c and ICONS in store/make_category_icons.py.
var ICON_DEFAULT = 0;
var ICON_PRODUCE = 1;
var ICON_BREAD = 2;
var ICON_DAIRY = 3;
var ICON_MEAT = 4;
var ICON_INGREDIENTS = 5;
var ICON_FROZEN = 6;
var ICON_GRAIN = 7;
var ICON_SNACKS = 8;
var ICON_DRINK = 9;
var ICON_HOUSEHOLD = 10;
var ICON_CARE = 11;
var ICON_PET = 12;
var ICON_GARDEN = 13;

// Bring!'s section ids (the same in every locale's catalog).
var SECTION_PRODUCE = 'Früchte & Gemüse';
var SECTION_BREAD = 'Brot & Gebäck';
var SECTION_DAIRY = 'Milch & Käse';
var SECTION_MEAT = 'Fleisch & Fisch';
var SECTION_INGREDIENTS = 'Zutaten & Gewürze';
var SECTION_FROZEN = 'Fertig- & Tiefkühlprodukte';
var SECTION_GRAIN = 'Getreideprodukte';
var SECTION_SNACKS = 'Snacks & Süsswaren';
var SECTION_DRINK = 'Getränke & Tabak';
var SECTION_HOUSEHOLD = 'Haushalt & Gesundheit';
var SECTION_CARE = 'Pflege & Gesundheit';
var SECTION_PET = 'Tierbedarf';
var SECTION_GARDEN = 'Baumarkt & Garten';

var SECTION_ICONS = {};
SECTION_ICONS[SECTION_PRODUCE] = ICON_PRODUCE;
SECTION_ICONS[SECTION_BREAD] = ICON_BREAD;
SECTION_ICONS[SECTION_DAIRY] = ICON_DAIRY;
SECTION_ICONS[SECTION_MEAT] = ICON_MEAT;
SECTION_ICONS[SECTION_INGREDIENTS] = ICON_INGREDIENTS;
SECTION_ICONS[SECTION_FROZEN] = ICON_FROZEN;
SECTION_ICONS[SECTION_GRAIN] = ICON_GRAIN;
SECTION_ICONS[SECTION_SNACKS] = ICON_SNACKS;
SECTION_ICONS[SECTION_DRINK] = ICON_DRINK;
SECTION_ICONS[SECTION_HOUSEHOLD] = ICON_HOUSEHOLD;
SECTION_ICONS[SECTION_CARE] = ICON_CARE;
SECTION_ICONS[SECTION_PET] = ICON_PET;
SECTION_ICONS[SECTION_GARDEN] = ICON_GARDEN;

// Name-guess rules per language, by Bring! section. Ties between equally long
// keywords go to the first rule.
var KEYWORDS = {
  en: { match: 'plural', rules: [
    { section: SECTION_BREAD, words: ['bread', 'baguette', 'croissant'] },
    { section: SECTION_DAIRY, words: ['milk', 'yogurt', 'cheese', 'butter', 'cream'] },
    { section: SECTION_PRODUCE, words: [
      'apple', 'banana', 'orange', 'pear', 'strawberry', 'grape', 'lemon', 'watermelon', 'melon',
      'kiwi', 'pineapple', 'peach', 'plum', 'fruit'] },
    { section: SECTION_PRODUCE, words: [
      'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'spinach', 'cucumber',
      'pepper', 'garlic', 'squash', 'vegetable', 'corn'] },
    { section: SECTION_MEAT, words: [
      'meat', 'chicken', 'fish', 'pork', 'ham', 'sausage', 'steak', 'hamburger', 'tuna', 'egg'] },
    { section: SECTION_DRINK, words: [
      'water', 'soda', 'juice', 'beer', 'wine', 'coffee', 'tea', 'drink', 'coke', 'fanta', 'sprite'] },
    { section: SECTION_HOUSEHOLD, words: [
      'soap', 'cleaner', 'shampoo', 'toilet paper', 'napkin', 'sponge', 'bleach', 'detergent'] }
  ] },
  es: { match: 'plural', rules: [
    { section: SECTION_BREAD, words: [
      'pan', 'pan de miga', 'tostado', 'tostadas', 'baguette', 'panaderia', 'panadería',
      'factura', 'facturas', 'medialuna', 'medialunas', 'croissant', 'bizcocho'] },
    { section: SECTION_DAIRY, words: [
      'leche', 'yogur', 'queso', 'manteca', 'mantequilla', 'crema', 'dulce de leche', 'ricota'] },
    { section: SECTION_PRODUCE, words: [
      'manzana', 'banana', 'platano', 'plátano', 'naranja', 'pera', 'frutilla', 'fresa', 'uva',
      'uvas', 'limon', 'limón', 'sandia', 'sandía', 'melon', 'melón', 'kiwi', 'anana', 'ananas',
      'piña', 'durazno', 'ciruela', 'mandarina', 'fruta'] },
    { section: SECTION_PRODUCE, words: [
      'lechuga', 'tomate', 'papa', 'patata', 'cebolla', 'zanahoria', 'brocoli', 'brócoli',
      'espinaca', 'pepino', 'pimiento', 'ajo', 'zapallo', 'calabaza', 'verdura', 'vegetal', 'choclo'] },
    { section: SECTION_MEAT, words: [
      'carne', 'pollo', 'pescado', 'cerdo', 'jamon', 'jamón', 'salchicha', 'milanesa', 'bife',
      'chorizo', 'hamburguesa', 'atun', 'atún', 'huevo', 'huevos'] },
    { section: SECTION_DRINK, words: [
      'agua', 'gaseosa', 'jugo', 'cerveza', 'vino', 'cafe', 'café', 'té', 'bebida', 'coca',
      'fanta', 'sprite', 'te'] },
    { section: SECTION_HOUSEHOLD, words: [
      'detergente', 'lavandina', 'jabon', 'jabón', 'limpiador', 'shampoo', 'champu', 'champú',
      'papel higienico', 'papel higiénico', 'servilleta', 'servilletas', 'esponja', 'lejia',
      'lejía', 'suavizante'] }
  ] },
  de: { match: 'suffix', rules: [
    { section: SECTION_BREAD, words: ['brot', 'brötchen'] },
    { section: SECTION_DAIRY, words: ['milch', 'käse', 'butter', 'joghurt'] },
    { section: SECTION_PRODUCE, words: ['apfel', 'äpfel', 'banane', 'bananen', 'obst'] },
    { section: SECTION_PRODUCE, words: ['gemüse', 'kartoffel', 'kartoffeln', 'zwiebel', 'zwiebeln', 'karotte', 'karotten', 'tomate', 'tomaten', 'gurke'] },
    { section: SECTION_MEAT, words: ['fleisch', 'hähnchen', 'fisch', 'schinken', 'schwein', 'ei', 'eier'] },
    { section: SECTION_DRINK, words: ['wasser', 'saft', 'bier', 'wein', 'kaffee', 'tee'] },
    { section: SECTION_HOUSEHOLD, words: ['seife', 'spülmittel', 'waschmittel'] }
  ] },
  fr: { match: 'plural', rules: [
    { section: SECTION_BREAD, words: ['pain'] },
    { section: SECTION_DAIRY, words: ['lait', 'fromage', 'beurre'] },
    { section: SECTION_PRODUCE, words: ['pomme', 'fraise', 'citron'] },
    { section: SECTION_PRODUCE, words: ['légume', 'pomme de terre', 'pommes de terre', 'oignon', 'carotte'] },
    { section: SECTION_MEAT, words: ['viande', 'poulet', 'poisson', 'jambon', 'oeuf', 'œuf'] },
    { section: SECTION_DRINK, words: ['eau', 'jus', 'bière', 'vin', 'thé'] },
    { section: SECTION_HOUSEHOLD, words: ['savon', 'lessive'] }
  ] },
  it: { match: 'plural', rules: [
    { section: SECTION_BREAD, words: ['pane'] },
    { section: SECTION_DAIRY, words: ['latte', 'formaggio', 'burro'] },
    { section: SECTION_PRODUCE, words: ['mela', 'fragola', 'limone'] },
    { section: SECTION_PRODUCE, words: ['verdura', 'patata', 'cipolla'] },
    { section: SECTION_MEAT, words: ['carne', 'pollo', 'pesce', 'prosciutto', 'uovo', 'uova'] },
    { section: SECTION_DRINK, words: ['acqua', 'succo', 'birra', 'vino'] },
    { section: SECTION_HOUSEHOLD, words: ['sapone', 'detersivo'] }
  ] },
  pt: { match: 'plural', rules: [
    { section: SECTION_BREAD, words: ['pão', 'pães', 'pao', 'paes'] },
    { section: SECTION_DAIRY, words: ['leite', 'queijo', 'manteiga'] },
    { section: SECTION_PRODUCE, words: ['maçã', 'morango', 'laranja'] },
    { section: SECTION_PRODUCE, words: ['legume', 'batata', 'cenoura'] },
    { section: SECTION_MEAT, words: ['carne', 'frango', 'peixe', 'presunto', 'ovo'] },
    { section: SECTION_DRINK, words: ['água', 'suco', 'cerveja', 'vinho'] },
    { section: SECTION_HOUSEHOLD, words: ['sabão', 'sabonete'] }
  ] }
};

// "de-DE" / "de_DE" / "de" -> "de"; null when there is no keyword table for it.
function languageOf(locale) {
  return Locale.pickSupported([locale], KEYWORDS, null);
}

// Accented last letter -> plain letter, for Spanish plurals (limón -> limones).
var UNACCENT = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };

// The forms of a keyword to accept as a whole word, per language.
function variants(word, language) {
  var last = word.charAt(word.length - 1);
  var stem = word.substring(0, word.length - 1);
  var list = [word];
  switch (language) {
    case 'en':
      list.push(word + 's', word + 'es');
      if (last === 'y') { list.push(stem + 'ies'); }
      break;
    case 'es':
      list.push(word + 's', word + 'es');
      if (UNACCENT[last]) { list.push(stem + UNACCENT[last] + 'es'); }
      if (last === 'z') { list.push(stem + 'ces'); }
      break;
    case 'fr':
      list.push(word + 's', word + 'x');
      break;
    case 'it': // plurals change the final vowel: mela -> mele, patata -> patate
      if (last === 'a') { list.push(stem + 'e'); }
      if (last === 'o' || last === 'e') { list.push(stem + 'i'); }
      break;
    case 'pt':
      list.push(word + 's', word + 'es');
      // -ão -> -ões (sabão -> sabões); irregular ones such as pão -> pães
      // are listed as keywords of their own.
      if (word.length > 2 && word.substring(word.length - 2) === 'ão') {
        list.push(word.substring(0, word.length - 2) + 'ões');
      }
      break;
  }
  return list;
}

function endsWith(text, suffix) {
  return text.length >= suffix.length && text.substring(text.length - suffix.length) === suffix;
}

// Flattened keyword list per language, built on first use and then reused:
// [{ section, length, suffix: bool, forms: [' tomato ', ' tomatoes ', ...] }]
// sorted longest first, so the first match is the longest one. Whole-word
// forms are stored padded with spaces, ready for indexOf on the padded name.
var s_compiled = {};

function compile(language) {
  var config = KEYWORDS[language];
  var list = [];
  var i, j, k, word, forms, entry;
  for (i = 0; i < config.rules.length; i++) {
    for (j = 0; j < config.rules[i].words.length; j++) {
      word = config.rules[i].words[j];
      entry = {
        section: config.rules[i].section,
        length: word.length,
        order: list.length,
        suffix: config.match === 'suffix' && word.length >= 3 && word.indexOf(' ') < 0,
        word: word,
        forms: []
      };
      if (!entry.suffix) {
        forms = variants(word, language);
        for (k = 0; k < forms.length; k++) {
          entry.forms.push(' ' + forms[k] + ' ');
        }
      }
      list.push(entry);
    }
  }
  // Longest keyword first; equally long keywords keep table order, so the
  // earlier rule wins a tie.
  list.sort(function (a, b) { return (b.length - a.length) || (a.order - b.order); });
  return list;
}

// Best-effort Bring! section for an item name, or null when nothing matches.
function guessSection(itemName, locale) {
  var language = languageOf(locale);
  if (!language) {
    return null;
  }
  var keywords = s_compiled[language] || (s_compiled[language] = compile(language));
  var words = String(itemName || '').toLowerCase().split(/[^a-zßà-ÿœ]+/).filter(Boolean);
  var padded = ' ' + words.join(' ') + ' ';
  var i, j, entry;
  for (i = 0; i < keywords.length; i++) {
    entry = keywords[i];
    if (entry.suffix) {
      for (j = 0; j < words.length; j++) {
        if (endsWith(words[j], entry.word)) { return entry.section; }
      }
    } else {
      for (j = 0; j < entry.forms.length; j++) {
        if (padded.indexOf(entry.forms[j]) >= 0) { return entry.section; }
      }
    }
  }
  return null;
}

function isKnownSection(sectionId) {
  return typeof sectionId === 'string' && SECTION_ICONS.hasOwnProperty(sectionId);
}

// Icon id for an item: { name, sectionId } where sectionId is the Bring!
// section (null/undefined when unknown) and locale the language of the name.
function iconFor(item, locale) {
  var section = item && item.sectionId;
  if (!isKnownSection(section)) {
    section = guessSection(item && item.name, locale);
  }
  return isKnownSection(section) ? SECTION_ICONS[section] : ICON_DEFAULT;
}

module.exports = {
  ICON_DEFAULT: ICON_DEFAULT,
  SECTION_ICONS: SECTION_ICONS,
  isKnownSection: isKnownSection,
  guessSection: guessSection,
  iconFor: iconFor
};
