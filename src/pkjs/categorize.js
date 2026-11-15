// Best-effort category guess from an item's name, used to pick a small icon
// for the watch's list rows. Bring! doesn't expose a category for
// custom/free-text items, so this just keyword-matches the name.
//
// Only the keywords of the user's own language are used (see languageOf()):
// short words from other languages cause false positives ('lait' vs. the
// French 'laitue'). Each language has two lists per category:
//   words: substring match (forgiving about plurals and compound words)
//   exact: whole-word/phrase match, for short or ambiguous words
// Whole-word matches are tried first and the longest keyword wins, so
// "pomme de terre" (potato) beats "pomme" (apple); substring matches are
// the fallback.

// Must match the ICON_* order in src/c/bring_pebble.c's icon lookup table.
var CATEGORY_DEFAULT = 0;
var CATEGORY_BREAD = 1;
var CATEGORY_DAIRY = 2;
var CATEGORY_FRUIT = 3;
var CATEGORY_VEGETABLE = 4;
var CATEGORY_MEAT = 5;
var CATEGORY_DRINK = 6;
var CATEGORY_CLEANING = 7;

var DEFAULT_LANGUAGE = 'en';

// Rule order matters only for substring matches: the first category with a hit wins.
var KEYWORDS = {
  en: [
    { category: CATEGORY_BREAD, words: ['bread', 'baguette', 'croissant'], exact: [] },
    { category: CATEGORY_DAIRY, words: ['milk', 'yogurt', 'cheese', 'butter', 'cream'], exact: [] },
    { category: CATEGORY_FRUIT, words: [
      'apple', 'banana', 'orange', 'pear', 'strawberry', 'grape', 'lemon', 'watermelon', 'melon',
      'kiwi', 'pineapple', 'peach', 'plum', 'fruit'
    ], exact: [] },
    { category: CATEGORY_VEGETABLE, words: [
      'lettuce', 'tomato', 'potato', 'onion', 'carrot', 'broccoli', 'spinach', 'cucumber',
      'pepper', 'garlic', 'squash', 'vegetable', 'corn'
    ], exact: [] },
    { category: CATEGORY_MEAT, words: [
      'meat', 'chicken', 'fish', 'pork', 'ham', 'sausage', 'steak', 'hamburger', 'tuna', 'egg'
    ], exact: [] },
    { category: CATEGORY_DRINK, words: [
      'water', 'soda', 'juice', 'beer', 'wine', 'coffee', 'tea', 'drink', 'coke', 'fanta', 'sprite'
    ], exact: [] },
    { category: CATEGORY_CLEANING, words: [
      'soap', 'cleaner', 'shampoo', 'toilet paper', 'napkin', 'sponge', 'bleach', 'detergent'
    ], exact: [] }
  ],
  es: [
    { category: CATEGORY_BREAD, words: [
      'pan', 'pan de miga', 'tostado', 'tostadas', 'baguette', 'panaderia', 'panadería',
      'factura', 'facturas', 'medialuna', 'medialunas', 'croissant', 'bizcocho'
    ], exact: [] },
    { category: CATEGORY_DAIRY, words: [
      'leche', 'yogur', 'queso', 'manteca', 'mantequilla', 'crema', 'dulce de leche', 'ricota'
    ], exact: [] },
    { category: CATEGORY_FRUIT, words: [
      'manzana', 'banana', 'platano', 'plátano', 'naranja', 'pera', 'frutilla', 'fresa', 'uva',
      'uvas', 'limon', 'limón', 'sandia', 'sandía', 'melon', 'melón', 'kiwi', 'anana', 'ananas',
      'piña', 'durazno', 'ciruela', 'mandarina', 'fruta'
    ], exact: [] },
    { category: CATEGORY_VEGETABLE, words: [
      'lechuga', 'tomate', 'papa', 'patata', 'cebolla', 'zanahoria', 'brocoli', 'brócoli',
      'espinaca', 'pepino', 'pimiento', 'ajo', 'zapallo', 'calabaza', 'verdura', 'vegetal', 'choclo'
    ], exact: [] },
    { category: CATEGORY_MEAT, words: [
      'carne', 'pollo', 'pescado', 'cerdo', 'jamon', 'jamón', 'salchicha', 'milanesa', 'bife',
      'chorizo', 'hamburguesa', 'atun', 'atún', 'huevo', 'huevos'
    ], exact: [] },
    { category: CATEGORY_DRINK, words: [
      'agua', 'gaseosa', 'jugo', 'cerveza', 'vino', 'cafe', 'café', 'té', 'bebida', 'coca',
      'fanta', 'sprite'
    ], exact: ['te'] },
    { category: CATEGORY_CLEANING, words: [
      'detergente', 'lavandina', 'jabon', 'jabón', 'limpiador', 'shampoo', 'champu', 'champú',
      'papel higienico', 'papel higiénico', 'servilleta', 'servilletas', 'esponja', 'lejia',
      'lejía', 'suavizante'
    ], exact: [] }
  ],
  de: [
    { category: CATEGORY_BREAD, words: [], exact: ['brot', 'brötchen'] },
    { category: CATEGORY_DAIRY, words: [], exact: ['milch', 'käse', 'butter', 'joghurt'] },
    { category: CATEGORY_FRUIT, words: [], exact: ['apfel', 'banane', 'obst'] },
    { category: CATEGORY_VEGETABLE, words: [], exact: ['gemüse', 'kartoffel', 'zwiebel', 'karotte'] },
    { category: CATEGORY_MEAT, words: [], exact: ['fleisch', 'hähnchen', 'fisch', 'schinken'] },
    { category: CATEGORY_DRINK, words: [], exact: ['wasser', 'saft', 'bier', 'wein', 'kaffee', 'tee'] },
    { category: CATEGORY_CLEANING, words: [], exact: ['seife', 'spülmittel', 'waschmittel'] }
  ],
  fr: [
    { category: CATEGORY_BREAD, words: [], exact: ['pain'] },
    { category: CATEGORY_DAIRY, words: [], exact: ['lait', 'fromage', 'beurre'] },
    { category: CATEGORY_FRUIT, words: [], exact: ['pomme', 'fraise', 'citron'] },
    { category: CATEGORY_VEGETABLE, words: [], exact: ['légume', 'pomme de terre', 'oignon', 'carotte'] },
    { category: CATEGORY_MEAT, words: [], exact: ['viande', 'poulet', 'poisson', 'jambon', 'oeuf', 'œuf'] },
    { category: CATEGORY_DRINK, words: [], exact: ['eau', 'jus', 'bière', 'vin', 'thé'] },
    { category: CATEGORY_CLEANING, words: [], exact: ['savon', 'lessive'] }
  ],
  it: [
    { category: CATEGORY_BREAD, words: [], exact: ['pane'] },
    { category: CATEGORY_DAIRY, words: [], exact: ['latte', 'formaggio', 'burro'] },
    { category: CATEGORY_FRUIT, words: [], exact: ['mela', 'fragola', 'limone'] },
    { category: CATEGORY_VEGETABLE, words: [], exact: ['verdura', 'patata', 'cipolla'] },
    { category: CATEGORY_MEAT, words: [], exact: ['carne', 'pollo', 'pesce', 'prosciutto', 'uovo'] },
    { category: CATEGORY_DRINK, words: [], exact: ['acqua', 'succo', 'birra', 'vino'] },
    { category: CATEGORY_CLEANING, words: [], exact: ['sapone', 'detersivo'] }
  ],
  pt: [
    { category: CATEGORY_BREAD, words: [], exact: ['pão', 'pao'] },
    { category: CATEGORY_DAIRY, words: [], exact: ['leite', 'queijo', 'manteiga'] },
    { category: CATEGORY_FRUIT, words: [], exact: ['maçã', 'morango', 'laranja'] },
    { category: CATEGORY_VEGETABLE, words: [], exact: ['legume', 'batata', 'cenoura'] },
    { category: CATEGORY_MEAT, words: [], exact: ['carne', 'frango', 'peixe', 'presunto', 'ovo'] },
    { category: CATEGORY_DRINK, words: [], exact: ['água', 'suco', 'cerveja', 'vinho'] },
    { category: CATEGORY_CLEANING, words: [], exact: ['sabão', 'sabonete'] }
  ]
};

// "de-DE" / "de_DE" / "de" -> "de"; unknown or missing -> English.
function languageOf(locale) {
  var code = String(locale || '').substring(0, 2).toLowerCase();
  return KEYWORDS[code] ? code : DEFAULT_LANGUAGE;
}

function categorize(itemName, locale) {
  var rules = KEYWORDS[languageOf(locale)];
  var name = (itemName || '').toLowerCase();
  var padded = ' ' + name.replace(/[^\wÀ-ÿœ]+/g, ' ') + ' ';
  var i, j, rule, word;
  var best = -1;
  var bestLength = 0;
  for (i = 0; i < rules.length; i++) {
    rule = rules[i];
    for (j = 0; j < rule.exact.length; j++) {
      word = rule.exact[j];
      if (word.length > bestLength && padded.indexOf(' ' + word + ' ') >= 0) {
        best = rule.category;
        bestLength = word.length;
      }
    }
  }
  if (best >= 0) {
    return best;
  }
  padded = ' ' + name + ' ';
  for (i = 0; i < rules.length; i++) {
    rule = rules[i];
    for (j = 0; j < rule.words.length; j++) {
      if (padded.indexOf(rule.words[j]) >= 0) {
        return rule.category;
      }
    }
  }
  return CATEGORY_DEFAULT;
}

module.exports = {
  categorize: categorize
};
