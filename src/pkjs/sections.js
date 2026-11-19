// Order of the open items on the watch: grouped by Bring! section, like the
// Bring! apps show the list. The section order is Bring!'s default unless the
// user changed it on the settings page (see config.js).
//
// Sections are identified by Bring!'s section ids (the German names, the same
// in every locale; see categorize.js). Items Bring! knows no section for
// (free-typed items the user never sorted into one) go where the Bring! apps
// show them: under "Eigene Artikel" (own items), last by default. The guessed
// section that picks such an item's icon does not move it, so the watch shows
// the same groups as the Bring! apps.
//
// Within a section the items keep the order Bring! returns them in. Completed
// items are not sorted: they stay below the open ones, as before.

var OWN_ITEMS = 'Eigene Artikel';

// Bring!'s default section order, as shown in the Bring! apps.
var DEFAULT_ORDER = [
  'Früchte & Gemüse',
  'Brot & Gebäck',
  'Milch & Käse',
  'Fleisch & Fisch',
  'Zutaten & Gewürze',
  'Fertig- & Tiefkühlprodukte',
  'Getreideprodukte',
  'Snacks & Süsswaren',
  'Getränke & Tabak',
  'Haushalt & Gesundheit',
  'Pflege & Gesundheit',
  'Tierbedarf',
  'Baumarkt & Garten',
  OWN_ITEMS
];

// Section names on the settings page, in DEFAULT_ORDER, for every language of
// the settings page (config.js TEXTS).
var NAMES = {
  en: ['Fruits & Vegetables', 'Bread & Pastries', 'Milk & Cheese', 'Meat & Fish',
    'Ingredients & Spices', 'Frozen & Convenience', 'Grain Products', 'Snacks & Sweets',
    'Beverages', 'Household', 'Care & Health', 'Pet Supplies', 'Home & Garden', 'Own Items'],
  es: ['Frutas y verduras', 'Pan y bollería', 'Leche y queso', 'Carne y pescado',
    'Ingredientes y especias', 'Congelados y platos preparados', 'Cereales', 'Snacks y dulces',
    'Bebidas', 'Hogar', 'Cuidado personal y salud', 'Mascotas', 'Bricolaje y jardín', 'Mis artículos'],
  de: ['Obst & Gemüse', 'Brot & Gebäck', 'Milch & Käse', 'Fleisch & Fisch',
    'Zutaten & Gewürze', 'Fertig- & Tiefkühlprodukte', 'Getreideprodukte', 'Snacks & Süsswaren',
    'Getränke', 'Haushalt', 'Pflege & Gesundheit', 'Tierbedarf', 'Baumarkt & Garten', 'Eigene Artikel'],
  fr: ['Fruits & légumes', 'Pains & pâtisseries', 'Lait & fromage', 'Viande & poisson',
    'Ingrédients & épices', 'Plats préparés & surgelés', 'Produits céréaliers', 'Snacks & confiseries',
    'Boissons', 'Ménage', 'Soins & santé', 'Animaux', 'Bricolage & jardin', 'Mes articles'],
  it: ['Frutta e verdura', 'Pane e dolci', 'Latte e formaggi', 'Carne e pesce',
    'Ingredienti e spezie', 'Piatti pronti e surgelati', 'Cereali', 'Snack e dolciumi',
    'Bevande', 'Casa', 'Cura e salute', 'Animali', 'Fai da te e giardino', 'I miei articoli'],
  pt: ['Frutas e legumes', 'Pães e bolos', 'Leite e queijo', 'Carne e peixe',
    'Ingredientes e temperos', 'Congelados e prontos', 'Cereais', 'Snacks e doces',
    'Bebidas', 'Casa', 'Cuidados e saúde', 'Animais', 'Ferramentas e jardim', 'Meus itens']
};

var STORAGE_KEY = 'bring_sectionOrder';

function isSection(id) {
  return DEFAULT_ORDER.indexOf(id) >= 0;
}

// A complete order from any input: known sections in the given order, each
// once, followed by the missing ones in Bring!'s default order (e.g. a section
// added in a later version).
function normalizeOrder(order) {
  var result = [];
  var i;
  var list = Array.isArray(order) ? order : [];
  for (i = 0; i < list.length; i++) {
    if (isSection(list[i]) && result.indexOf(list[i]) < 0) {
      result.push(list[i]);
    }
  }
  for (i = 0; i < DEFAULT_ORDER.length; i++) {
    if (result.indexOf(DEFAULT_ORDER[i]) < 0) {
      result.push(DEFAULT_ORDER[i]);
    }
  }
  return result;
}

function loadOrder() {
  try {
    return normalizeOrder(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch (e) {
    return DEFAULT_ORDER.slice();
  }
}

function saveOrder(order) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeOrder(order)));
}

// Items: [{ sectionId, done, ... }]. Returns a new array with the open items
// grouped by section in `order`, then the completed items unchanged.
function sortItems(items, order) {
  var rank = {};
  var full = normalizeOrder(order);
  var i;
  for (i = 0; i < full.length; i++) {
    rank[full[i]] = i;
  }
  var open = [];
  var done = [];
  for (i = 0; i < items.length; i++) {
    if (items[i].done) {
      done.push(items[i]);
    } else {
      var section = items[i].sectionId;
      open.push({ item: items[i], rank: isSection(section) ? rank[section] : rank[OWN_ITEMS], index: i });
    }
  }
  // Array.prototype.sort is not stable in every JS engine the Pebble app runs
  // on, so ties are broken by the original position.
  open.sort(function (a, b) { return (a.rank - b.rank) || (a.index - b.index); });
  return open.map(function (entry) { return entry.item; }).concat(done);
}

// The display name of a section on the settings page.
function nameOf(sectionId, lang) {
  var names = NAMES[lang] || NAMES.en;
  var index = DEFAULT_ORDER.indexOf(sectionId);
  return index >= 0 ? names[index] : String(sectionId);
}

module.exports = {
  OWN_ITEMS: OWN_ITEMS,
  DEFAULT_ORDER: DEFAULT_ORDER,
  NAMES: NAMES,
  normalizeOrder: normalizeOrder,
  loadOrder: loadOrder,
  saveOrder: saveOrder,
  sortItems: sortItems,
  nameOf: nameOf
};
