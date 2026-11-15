// Best-effort category guess from an item's name, used to pick a small icon
// for the watch's list rows. Bring! doesn't expose a category for
// custom/free-text items, so this just keyword-matches the name. Keywords
// cover English, Spanish, German, French, Italian and Portuguese, matching the
// languages the app is localized in.

// Must match the ICON_* order in src/c/bring_pebble.c's icon lookup table.
var CATEGORY_DEFAULT = 0;
var CATEGORY_BREAD = 1;
var CATEGORY_DAIRY = 2;
var CATEGORY_FRUIT = 3;
var CATEGORY_VEGETABLE = 4;
var CATEGORY_MEAT = 5;
var CATEGORY_DRINK = 6;
var CATEGORY_CLEANING = 7;

var RULES = [
  { category: CATEGORY_BREAD, words: [
    'brot', 'brötchen', 'pain', 'pane', 'pão', 'pao',
    'pan', 'pan de miga', 'tostado', 'tostadas', 'baguette', 'bread', 'panaderia',
    'panadería', 'factura', 'facturas', 'medialuna', 'medialunas', 'croissant', 'bizcocho'
  ] },
  { category: CATEGORY_DAIRY, words: [
    'milch', 'käse', 'butter', 'joghurt', 'lait', 'fromage', 'beurre', 'latte', 'formaggio', 'burro', 'leite', 'queijo', 'manteiga',
    'leche', 'milk', 'yogur', 'yogurt', 'queso', 'cheese', 'manteca', 'mantequilla',
    'butter', 'crema', 'cream', 'dulce de leche', 'ricota'
  ] },
  { category: CATEGORY_FRUIT, words: [
    'apfel', 'banane', 'obst', 'pomme', 'fraise', 'citron', 'mela', 'fragola', 'limone', 'maçã', 'morango', 'laranja',
    'manzana', 'apple', 'banana', 'platano', 'plátano', 'naranja', 'orange', 'pera', 'pear',
    'frutilla', 'fresa', 'strawberry', 'uva', 'uvas', 'grape', 'limon', 'limón', 'lemon',
    'sandia', 'sandía', 'watermelon', 'melon', 'melón', 'kiwi', 'anana', 'ananas', 'piña',
    'pineapple', 'durazno', 'peach', 'ciruela', 'plum', 'mandarina', 'fruta', 'fruit'
  ] },
  { category: CATEGORY_VEGETABLE, words: [
    'gemüse', 'kartoffel', 'zwiebel', 'karotte', 'légume', 'pomme de terre', 'oignon', 'carotte', 'verdura', 'patata', 'cipolla', 'cenoura', 'batata', 'legume',
    'lechuga', 'lettuce', 'tomate', 'tomato', 'papa', 'patata', 'potato', 'cebolla', 'onion',
    'zanahoria', 'carrot', 'brocoli', 'brócoli', 'broccoli', 'espinaca', 'spinach', 'pepino',
    'cucumber', 'pimiento', 'pepper', 'ajo', 'garlic', 'zapallo', 'calabaza', 'squash',
    'verdura', 'vegetable', 'vegetal', 'choclo', 'corn'
  ] },
  { category: CATEGORY_MEAT, words: [
    'fleisch', 'hähnchen', 'fisch', 'schinken', 'viande', 'poulet', 'poisson', 'jambon', 'oeuf', 'œuf', 'carne', 'pollo', 'pesce', 'prosciutto', 'uovo', 'frango', 'peixe', 'presunto', 'ovo',
    'carne', 'meat', 'pollo', 'chicken', 'pescado', 'fish', 'cerdo', 'pork', 'jamon', 'jamón',
    'ham', 'salchicha', 'sausage', 'milanesa', 'bife', 'steak', 'chorizo', 'hamburguesa',
    'hamburger', 'atun', 'atún', 'tuna', 'huevo', 'huevos', 'egg', 'eggs'
  ] },
  { category: CATEGORY_DRINK, words: [
    'wasser', 'saft', 'bier', 'wein', 'kaffee', 'tee', 'eau', 'jus', 'bière', 'vin', 'thé', 'acqua', 'succo', 'birra', 'vinho', 'cerveja', 'suco',
    'agua', 'water', 'gaseosa', 'soda', 'jugo', 'juice', 'cerveza', 'beer', 'vino', 'wine',
    'cafe', 'café', 'coffee', ' te ', 'té', 'tea', 'bebida', 'drink', 'coca', 'fanta', 'sprite'
  ] },
  { category: CATEGORY_CLEANING, words: [
    'seife', 'spülmittel', 'waschmittel', 'savon', 'lessive', 'sapone', 'detersivo', 'sabão', 'sabonete',
    'detergente', 'lavandina', 'jabon', 'jabón', 'soap', 'limpiador', 'cleaner', 'shampoo',
    'champu', 'champú', 'papel higienico', 'papel higiénico', 'toilet paper', 'servilleta',
    'servilletas', 'napkin', 'esponja', 'sponge', 'lejia', 'lejía', 'bleach', 'suavizante'
  ] }
];

function categorize(itemName) {
  var name = ' ' + (itemName || '').toLowerCase() + ' ';
  var i, j, rule;
  for (i = 0; i < RULES.length; i++) {
    rule = RULES[i];
    for (j = 0; j < rule.words.length; j++) {
      if (name.indexOf(rule.words[j]) >= 0) {
        return rule.category;
      }
    }
  }
  return CATEGORY_DEFAULT;
}

module.exports = {
  categorize: categorize
};
