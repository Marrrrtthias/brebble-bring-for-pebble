// Checks that constants duplicated between the watch (C) and the phone (JS)
// stay in sync, since the compiler can't check this (run with `npm test`).
var test = require('node:test');
var assert = require('node:assert');
var fs = require('node:fs');
var path = require('node:path');

var root = path.join(__dirname, '..', '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

var cSource = read('src/c/bring_pebble.c');
var indexJs = read('src/pkjs/index.js');

// "  NAME = 3," inside a C enum -> { NAME: 3 }
function cEnum(prefix) {
  var values = {};
  var re = new RegExp('^\\s*(' + prefix + '\\w+)\\s*=\\s*(\\d+)', 'gm');
  var m;
  while ((m = re.exec(cSource))) { values[m[1]] = Number(m[2]); }
  return values;
}

// "var NAME = 3;" -> { NAME: 3 }
function jsConstants(source, prefix) {
  var values = {};
  var re = new RegExp('^var (' + prefix + '\\w+) = (\\d+);', 'gm');
  var m;
  while ((m = re.exec(source))) { values[m[1]] = Number(m[2]); }
  return values;
}

test('action codes match between C and JS', function () {
  var c = cEnum('ACTION_');
  assert.ok(Object.keys(c).length >= 8);
  assert.deepStrictEqual(jsConstants(indexJs, 'ACTION_'), c);
});

test('every error code sent by JS exists in C with the same value', function () {
  var c = cEnum('ERR_');
  var js = jsConstants(indexJs, 'ERR_');
  assert.ok(Object.keys(js).length >= 5);
  Object.keys(js).forEach(function (name) {
    assert.strictEqual(c[name], js[name], name);
  });
});

test('icon ids in JS match the icon table order in C', function () {
  var js = jsConstants(read('src/pkjs/categorize.js'), 'ICON_');
  var table = cSource.match(/CATEGORY_RESOURCE_IDS\[[^\]]*\] = \{([^}]*)\}/)[1];
  var icons = table.match(/RESOURCE_ID_ICON_\w+/g);
  icons.forEach(function (icon, index) {
    var name = icon.replace('RESOURCE_ID_', '');
    assert.strictEqual(js[name], index, name);
  });
  assert.strictEqual(Object.keys(js).length, icons.length);
});

test('every message key used in code is declared in package.json', function () {
  var declared = JSON.parse(read('package.json')).pebble.messageKeys;
  var used = {};
  (cSource.match(/MESSAGE_KEY_\w+/g) || []).forEach(function (k) {
    used[k.replace('MESSAGE_KEY_', '')] = true;
  });
  Object.keys(used).forEach(function (key) {
    assert.ok(declared.indexOf(key) >= 0, key + ' missing from package.json');
  });
});

test('every icon in the C table is a declared resource with generated images', function () {
  var media = JSON.parse(read('package.json')).pebble.resources.media;
  var script = read('store/make_category_icons.py');
  var table = cSource.match(/CATEGORY_RESOURCE_IDS\[[^\]]*\] = \{([^}]*)\}/)[1];
  var icons = table.match(/RESOURCE_ID_ICON_\w+/g);
  var scriptNames = script.match(/ICONS = \{([^}]*)\}/)[1].match(/"(\w+)":/g).map(function (s) {
    return s.slice(1, -2);
  });
  icons.forEach(function (icon, index) {
    var name = icon.replace('RESOURCE_ID_ICON_', '').toLowerCase();
    var entry = media.filter(function (m) { return m.name === 'ICON_' + name.toUpperCase(); })[0];
    assert.ok(entry, icon + ' missing from package.json');
    ['', '~emery', '~gabbro'].forEach(function (suffix) {
      var file = 'resources/' + entry.file.replace('.png', suffix + '.png');
      assert.ok(fs.existsSync(path.join(root, file)), file);
    });
    assert.strictEqual(scriptNames[index], name, 'make_category_icons.py ICONS order');
  });
  assert.strictEqual(scriptNames.length, icons.length);
});

test('item details sent by JS fit the watch buffer when they are plain ASCII', function () {
  var js = Number(indexJs.match(/^var MAX_DETAIL = (\d+);/m)[1]);
  var c = Number(cSource.match(/^#define MAX_DETAIL_LEN (\d+)/m)[1]);
  // JS adds a 3-byte "…" when it shortens a detail; the watch needs a NUL too.
  assert.ok(js + 3 + 1 <= c, 'MAX_DETAIL ' + js + ' vs MAX_DETAIL_LEN ' + c);
});
