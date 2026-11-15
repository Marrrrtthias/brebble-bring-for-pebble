// Best-effort category guess from an item's name, used to pick a small icon
// for the watch's list rows. Bring! doesn't expose a category for
// custom/free-text items, so this just keyword-matches the name.
//
// Only the keywords of the language the item names are in are used (the
// caller passes that locale; see languageOf()): short words from other
// languages cause false positives ('lait' vs. the French 'laitue'). For a
// language without a keyword table nothing is matched and every item gets
// the default icon. How a keyword is matched depends on the language:
//   'plural': whole word or phrase, also in the language's common plural
//             forms ('tomato' matches 'tomatoes', 'limón' matches 'limones').
//             Never matches inside another word ('tea' does not hit 'steak').
//   'suffix': German builds compound nouns whose head noun comes last
//             ('Vollmilch', 'Kartoffelsalat'), so a keyword also matches at
//             the end of a word (keywords under 3 letters must match whole).
// Across all categories the longest matching keyword wins, so "pomme de
// terre" (potato) beats "pomme" (apple) and "schwein" beats "wein".

var Locale = require('./locale');

// Must match the ICON_* order in src/c/bring_pebble.c's icon lookup table.
var CATEGORY_DEFAULT = 0;
var CATEGORY_BREAD = 1;
var CATEGORY_DAIRY = 2;
var CATEGORY_FRUIT = 3;
var CATEGORY_VEGETABLE = 4;
var CATEGORY_MEAT = 5;
var CATEGORY_DRINK = 6;
var CATEGORY_CLEANING = 7;

// Rules per language. Ties between equally long keywords go to the first category.
var KEYWORDS = {
  en: { match: 'plural', rules: [
    { category: CATEGORY_BREAD, words: ['bread', 'baguette', 'croissant'] },
    { category: CATEGORY_DAIRY, words: ['milk', 'yogurt', 'cheese', 'butter', 'cream'] },
    { category: CATEGORY_FRUIT, words: [
      'apple', 'banana', 'orange', 'pear', 'strawberry', 'grape', 'lemon', 'watermelon', 'melon',
      'kiwi', 'pineapple', 'peach', 'plum', 'fruit'] },
    { category: CATEGORY_VEGETABLE, words: [
      'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'spinach', 'cucumber',
      'pepper', 'garlic', 'squash', 'vegetable', 'corn'] },
    { category: CATEGORY_MEAT, words: [
      'meat', 'chicken', 'fish', 'pork', 'ham', 'sausage', 'steak', 'hamburger', 'tuna', 'egg'] },
    { category: CATEGORY_DRINK, words: [
      'water', 'soda', 'juice', 'beer', 'wine', 'coffee', 'tea', 'drink', 'coke', 'fanta', 'sprite'] },
    { category: CATEGORY_CLEANING, words: [
      'soap', 'cleaner', 'shampoo', 'toilet paper', 'napkin', 'sponge', 'bleach', 'detergent'] }
  ] },
  es: { match: 'plural', rules: [
    { category: CATEGORY_BREAD, words: [
      'pan', 'pan de miga', 'tostado', 'tostadas', 'baguette', 'panaderia', 'panadería',
      'factura', 'facturas', 'medialuna', 'medialunas', 'croissant', 'bizcocho'] },
    { category: CATEGORY_DAIRY, words: [
      'leche', 'yogur', 'queso', 'manteca', 'mantequilla', 'crema', 'dulce de leche', 'ricota'] },
    { category: CATEGORY_FRUIT, words: [
      'manzana', 'banana', 'platano', 'plátano', 'naranja', 'pera', 'frutilla', 'fresa', 'uva',
      'uvas', 'limon', 'limón', 'sandia', 'sandía', 'melon', 'melón', 'kiwi', 'anana', 'ananas',
      'piña', 'durazno', 'ciruela', 'mandarina', 'fruta'] },
    { category: CATEGORY_VEGETABLE, words: [
      'lechuga', 'tomate', 'papa', 'patata', 'cebolla', 'zanahoria', 'brocoli', 'brócoli',
      'espinaca', 'pepino', 'pimiento', 'ajo', 'zapallo', 'calabaza', 'verdura', 'vegetal', 'choclo'] },
    { category: CATEGORY_MEAT, words: [
      'carne', 'pollo', 'pescado', 'cerdo', 'jamon', 'jamón', 'salchicha', 'milanesa', 'bife',
      'chorizo', 'hamburguesa', 'atun', 'atún', 'huevo', 'huevos'] },
    { category: CATEGORY_DRINK, words: [
      'agua', 'gaseosa', 'jugo', 'cerveza', 'vino', 'cafe', 'café', 'té', 'bebida', 'coca',
      'fanta', 'sprite', 'te'] },
    { category: CATEGORY_CLEANING, words: [
      'detergente', 'lavandina', 'jabon', 'jabón', 'limpiador', 'shampoo', 'champu', 'champú',
      'papel higienico', 'papel higiénico', 'servilleta', 'servilletas', 'esponja', 'lejia',
      'lejía', 'suavizante'] }
  ] },
  de: { match: 'suffix', rules: [
    { category: CATEGORY_BREAD, words: ['brot', 'brötchen'] },
    { category: CATEGORY_DAIRY, words: ['milch', 'käse', 'butter', 'joghurt'] },
    { category: CATEGORY_FRUIT, words: ['apfel', 'äpfel', 'banane', 'bananen', 'obst'] },
    { category: CATEGORY_VEGETABLE, words: ['gemüse', 'kartoffel', 'kartoffeln', 'zwiebel', 'zwiebeln', 'karotte', 'karotten', 'tomate', 'tomaten', 'gurke'] },
    { category: CATEGORY_MEAT, words: ['fleisch', 'hähnchen', 'fisch', 'schinken', 'schwein', 'ei', 'eier'] },
    { category: CATEGORY_DRINK, words: ['wasser', 'saft', 'bier', 'wein', 'kaffee', 'tee'] },
    { category: CATEGORY_CLEANING, words: ['seife', 'spülmittel', 'waschmittel'] }
  ] },
  fr: { match: 'plural', rules: [
    { category: CATEGORY_BREAD, words: ['pain'] },
    { category: CATEGORY_DAIRY, words: ['lait', 'fromage', 'beurre'] },
    { category: CATEGORY_FRUIT, words: ['pomme', 'fraise', 'citron'] },
    { category: CATEGORY_VEGETABLE, words: ['légume', 'pomme de terre', 'pommes de terre', 'oignon', 'carotte'] },
    { category: CATEGORY_MEAT, words: ['viande', 'poulet', 'poisson', 'jambon', 'oeuf', 'œuf'] },
    { category: CATEGORY_DRINK, words: ['eau', 'jus', 'bière', 'vin', 'thé'] },
    { category: CATEGORY_CLEANING, words: ['savon', 'lessive'] }
  ] },
  it: { match: 'plural', rules: [
    { category: CATEGORY_BREAD, words: ['pane'] },
    { category: CATEGORY_DAIRY, words: ['latte', 'formaggio', 'burro'] },
    { category: CATEGORY_FRUIT, words: ['mela', 'fragola', 'limone'] },
    { category: CATEGORY_VEGETABLE, words: ['verdura', 'patata', 'cipolla'] },
    { category: CATEGORY_MEAT, words: ['carne', 'pollo', 'pesce', 'prosciutto', 'uovo', 'uova'] },
    { category: CATEGORY_DRINK, words: ['acqua', 'succo', 'birra', 'vino'] },
    { category: CATEGORY_CLEANING, words: ['sapone', 'detersivo'] }
  ] },
  pt: { match: 'plural', rules: [
    { category: CATEGORY_BREAD, words: ['pão', 'pães', 'pao', 'paes'] },
    { category: CATEGORY_DAIRY, words: ['leite', 'queijo', 'manteiga'] },
    { category: CATEGORY_FRUIT, words: ['maçã', 'morango', 'laranja'] },
    { category: CATEGORY_VEGETABLE, words: ['legume', 'batata', 'cenoura'] },
    { category: CATEGORY_MEAT, words: ['carne', 'frango', 'peixe', 'presunto', 'ovo'] },
    { category: CATEGORY_DRINK, words: ['água', 'suco', 'cerveja', 'vinho'] },
    { category: CATEGORY_CLEANING, words: ['sabão', 'sabonete'] }
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
// [{ category, length, suffix: bool, forms: [' tomato ', ' tomatoes ', ...] }]
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
        category: config.rules[i].category,
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
  // earlier category wins a tie.
  list.sort(function (a, b) { return (b.length - a.length) || (a.order - b.order); });
  return list;
}

function categorize(itemName, locale) {
  var language = languageOf(locale);
  if (!language) {
    return CATEGORY_DEFAULT;
  }
  var keywords = s_compiled[language] || (s_compiled[language] = compile(language));
  var words = String(itemName || '').toLowerCase().split(/[^a-zßà-ÿœ]+/).filter(Boolean);
  var padded = ' ' + words.join(' ') + ' ';
  var i, j, entry;
  for (i = 0; i < keywords.length; i++) {
    entry = keywords[i];
    if (entry.suffix) {
      for (j = 0; j < words.length; j++) {
        if (endsWith(words[j], entry.word)) { return entry.category; }
      }
    } else {
      for (j = 0; j < entry.forms.length; j++) {
        if (padded.indexOf(entry.forms[j]) >= 0) { return entry.category; }
      }
    }
  }
  return CATEGORY_DEFAULT;
}

module.exports = {
  categorize: categorize
};
