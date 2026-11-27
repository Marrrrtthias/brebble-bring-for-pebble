// Minimal client for the unofficial Bring! REST API, reverse-engineered by the
// community (see https://github.com/miaucl/bring-api, used by Home Assistant).
// Runs inside PebbleKit JS on the phone; the watch never talks to Bring! directly.

var BRING_BASE = 'https://api.getbring.com/rest/';
var BRING_API_KEY = 'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp';
var DEFAULT_COUNTRY = 'DE'; // fallback only, used before the account's real country is known

// Bring! stores catalog items (picked from their in-app suggestions, as
// opposed to free-typed items) under a canonical German name regardless of
// the account's language, and translates them client-side using a public
// per-locale dictionary. Mirrors the locale handling in
// https://github.com/miaucl/bring-api (used by Home Assistant).
var BRING_DEFAULT_LOCALE = 'de-CH'; // catalog items are already in this locale: no translation needed
var BRING_SUPPORTED_LOCALES = [
  'de-AT', 'de-CH', 'de-DE', 'en-AU', 'en-CA', 'en-GB', 'en-US', 'es-ES',
  'fr-CH', 'fr-FR', 'hu-HU', 'it-CH', 'it-IT', 'nb-NO', 'nl-NL', 'pl-PL',
  'pt-BR', 'ru-RU', 'sv-SE', 'tr-TR'
];
var MAP_LANG_TO_LOCALE = {
  de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', hu: 'hu-HU', it: 'it-IT',
  nb: 'nb-NO', nl: 'nl-NL', pl: 'pl-PL', pt: 'pt-BR', ru: 'ru-RU', sv: 'sv-SE', tr: 'tr-TR'
};
var LOCALES_BASE_URL = 'https://web.getbring.com/locale/';

// { locale: { forward: {germanId: localizedText}, reverse: {localizedText: germanId} } }
// In-memory only: cheap enough to refetch if pkjs restarts, no need to burn localStorage on it.
var s_translationsCache = {};

// Item sections ("categories"). The list endpoint only returns item ids, no
// section. Bring!'s apps take the section from:
//  - the public per-locale catalog, LOCALES_BASE_URL + 'catalog.<locale>.json':
//    { language, catalog: { sections: [{ sectionId, name, items: [{ itemId, name }] }] } }
//    sectionId is the German section name ('Früchte & Gemüse', ...) in every
//    locale, name the localized one; itemId is the canonical (German) item id,
//    as used in the list. Locales differ slightly in which items they list
//    (regional products), so the account's own locale is used.
//  - the list's item details, GET v2/bringlists/<listUuid>/details:
//    [{ uuid, itemId, listUuid, userIconItemId, userSectionId, assignedTo, imageReference }]
//    for items the user moved to another section or sorted a free-typed item
//    into one (userSectionId, '' when not set). This overrides the catalog.
// Free-typed items the user never sorted have no section at all.
// { locale: { canonicalItemId: sectionId } }, in memory like the translations.
var s_catalogSectionsCache = {};

function loadState() {
  return {
    email: localStorage.getItem('bring_email') || '',
    password: localStorage.getItem('bring_password') || '',
    uuid: localStorage.getItem('bring_uuid') || '',
    publicUuid: localStorage.getItem('bring_publicUuid') || '',
    accessToken: localStorage.getItem('bring_accessToken') || '',
    refreshToken: localStorage.getItem('bring_refreshToken') || '',
    tokenType: localStorage.getItem('bring_tokenType') || 'Bearer',
    expiresAt: parseInt(localStorage.getItem('bring_expiresAt') || '0', 10),
    listUuid: localStorage.getItem('bring_listUuid') || '',
    listName: localStorage.getItem('bring_listName') || '',
    locale: localStorage.getItem('bring_locale') || '',
    country: localStorage.getItem('bring_country') || ''
  };
}

// The list name the user typed in the settings ('' = the account's default
// list). Older versions only stored the resolved name in bring_listName, which
// the settings page used to prefill, so that is the fallback.
function loadWantedListName() {
  var wanted = localStorage.getItem('bring_wantedList');
  return wanted !== null ? wanted : (localStorage.getItem('bring_listName') || '');
}

// Session data derived from the credentials. Dropped when the credentials
// change, since it belongs to the old login (or the old account).
var SESSION_KEYS = ['uuid', 'publicUuid', 'accessToken', 'refreshToken', 'tokenType',
  'expiresAt', 'locale', 'country'];
var LIST_KEYS = ['listUuid', 'listName'];

function removeKeys(keys) {
  for (var i = 0; i < keys.length; i++) {
    localStorage.removeItem('bring_' + keys[i]);
  }
}

// Stores what the user entered in the settings. This is the only place the
// credentials are written, and they are never removed: a failed login or
// network error must not cost the user their settings. Derived data (tokens,
// resolved list) is dropped only when the input it came from changed.
function saveCredentials(email, password, wantedListName) {
  var old = loadState();
  var accountChanged = old.email.toLowerCase() !== email.toLowerCase() || old.password !== password;
  var listChanged = loadWantedListName().toLowerCase() !== wantedListName.toLowerCase();
  if (accountChanged) {
    removeKeys(SESSION_KEYS);
  }
  if (accountChanged || listChanged) {
    removeKeys(LIST_KEYS);
  }
  localStorage.setItem('bring_email', email);
  localStorage.setItem('bring_password', password);
  localStorage.setItem('bring_wantedList', wantedListName);
  localStorage.removeItem('bring_configError'); // left over from older versions
}

// Result of the last account check, shown on the settings page:
// { ok, reason, lists: [names], listName, wantedListName, email, test, at }
function saveLastCheck(check) {
  localStorage.setItem('bring_lastCheck', JSON.stringify(check));
}

function loadLastCheck() {
  try {
    return JSON.parse(localStorage.getItem('bring_lastCheck') || 'null');
  } catch (e) {
    return null;
  }
}

function saveState(state) {
  var key;
  for (key in state) {
    if (state.hasOwnProperty(key) && state[key] !== undefined && state[key] !== null) {
      localStorage.setItem('bring_' + key, state[key]);
    }
  }
}

function formEncode(obj) {
  var parts = [];
  var k;
  for (k in obj) {
    if (obj.hasOwnProperty(k)) {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
    }
  }
  return parts.join('&');
}

function authHeaders(state) {
  var h = {
    'X-BRING-API-KEY': BRING_API_KEY,
    'X-BRING-CLIENT': 'android',
    'X-BRING-APPLICATION': 'bring',
    'X-BRING-COUNTRY': state.country || DEFAULT_COUNTRY
  };
  if (state.tokenType && state.accessToken) {
    h['Authorization'] = state.tokenType + ' ' + state.accessToken;
  }
  if (state.uuid) {
    h['X-BRING-USER-UUID'] = state.uuid;
  }
  if (state.publicUuid) {
    h['X-BRING-PUBLIC-USER-UUID'] = state.publicUuid;
  }
  return h;
}

// Requests reach api.getbring.com and web.getbring.com under the required
// Internet permissions declared in package.json's usesPermissions: the Pebble
// app asks for them at install. If the user denied one, or turned it off
// later, a request fails without a response like a network error.
// Pebble.permissions.query tells these apart; phone apps without the
// permission system have no Pebble.permissions. A query that hasn't answered
// after PERMISSION_QUERY_TIMEOUT_MS counts as unknown, so the request's error
// is still reported.
var PERMISSION_QUERY_TIMEOUT_MS = 2000;

function permissionState(url, callback) {
  var answered = false;
  var timer = null;
  function answer(state) {
    if (answered) { return; }
    answered = true;
    if (timer !== null) { clearTimeout(timer); }
    callback(state);
  }
  var host = /^https?:\/\/([^\/?#]+)/i.exec(url);
  var permissions = typeof Pebble !== 'undefined' && Pebble.permissions;
  if (!host || !permissions || typeof permissions.query !== 'function') {
    answer(null);
    return;
  }
  timer = setTimeout(function () { answer(null); }, PERMISSION_QUERY_TIMEOUT_MS);
  try {
    permissions.query('Internet/' + host[1].toLowerCase()).then(answer, function () { answer(null); });
  } catch (e) {
    answer(null);
  }
}

// A request that got no response: err.permission is 'prompt' or 'denied' when
// the user hasn't allowed (or turned off) internet access for the host.
function failWithoutResponse(url, message, callback) {
  var err = new Error(message);
  err.status = 0;
  permissionState(url, function (state) {
    if (state === 'prompt' || state === 'denied') {
      err.permission = state;
    }
    callback(err, null, 0);
  });
}

function xhrRequest(method, url, headers, body, callback) {
  var xhr = new XMLHttpRequest();
  xhr.timeout = 15000;
  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      var data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (e) {
        // Some endpoints return an empty body on success; that's fine.
      }
      callback(null, data, xhr.status);
    } else {
      var err = new Error('HTTP ' + xhr.status);
      err.status = xhr.status;
      callback(err, null, xhr.status);
    }
  };
  xhr.onerror = function () {
    failWithoutResponse(url, 'network error', callback);
  };
  xhr.ontimeout = function () {
    failWithoutResponse(url, 'timeout', callback);
  };
  xhr.open(method, url, true);
  var k;
  for (k in headers) {
    if (headers.hasOwnProperty(k)) {
      xhr.setRequestHeader(k, headers[k]);
    }
  }
  xhr.send(body || null);
}

function login(email, password, callback) {
  var headers = authHeaders({});
  headers['Content-Type'] = 'application/x-www-form-urlencoded';
  var body = formEncode({ email: email, password: password });
  xhrRequest('POST', BRING_BASE + 'v2/bringauth', headers, body, callback);
}

function refreshToken(state, callback) {
  var headers = authHeaders(state);
  headers['Content-Type'] = 'application/x-www-form-urlencoded';
  var body = formEncode({ grant_type: 'refresh_token', refresh_token: state.refreshToken });
  xhrRequest('POST', BRING_BASE + 'v2/bringauth/token', headers, body, callback);
}

function resolveLocale(language, country) {
  var candidate = language + '-' + country;
  if (BRING_SUPPORTED_LOCALES.indexOf(candidate) >= 0) {
    return candidate;
  }
  return MAP_LANG_TO_LOCALE[language] || BRING_DEFAULT_LOCALE;
}

function fetchUserLocale(state, callback) {
  var headers = authHeaders(state);
  xhrRequest('GET', BRING_BASE + 'v2/bringusers/' + state.uuid, headers, null, function (err, data) {
    if (err || !data || !data.userLocale) {
      callback(err || new Error('missing userLocale'));
      return;
    }
    callback(null, data.userLocale);
  });
}

// Best-effort: figures out the account's real language/country (like the
// official app does) so catalog items can be shown translated instead of in
// German. Never fails the caller — if this can't be determined, callers just
// fall back to BRING_DEFAULT_LOCALE (untranslated) for this round.
function applyUserLocale(state, callback, persist) {
  if (state.locale && state.country) {
    callback(state);
    return;
  }
  fetchUserLocale(state, function (err, userLocale) {
    if (err) {
      callback(state);
      return;
    }
    state.country = userLocale.country || DEFAULT_COUNTRY;
    state.locale = resolveLocale(userLocale.language || 'de', state.country);
    if (persist !== false) {
      saveState(state);
    }
    callback(state);
  });
}

function buildReverseDict(dict) {
  var rev = {};
  var k;
  for (k in dict) {
    if (dict.hasOwnProperty(k)) {
      rev[dict[k]] = k;
    }
  }
  return rev;
}

// dict.forward: {germanCatalogId: localizedText}, dict.reverse: the opposite,
// used to recover the real itemId when the watch reports back a translated
// name (e.g. after toggling an item).
function loadTranslations(locale, callback) {
  if (locale === BRING_DEFAULT_LOCALE) {
    callback({ forward: {}, reverse: {} });
    return;
  }
  if (s_translationsCache[locale]) {
    callback(s_translationsCache[locale]);
    return;
  }
  xhrRequest('GET', LOCALES_BASE_URL + 'articles.' + locale + '.json', {}, null, function (err, data) {
    if (err || !data) {
      callback({ forward: {}, reverse: {} }); // transient failure: don't cache, retry next sync
      return;
    }
    var entry = { forward: data, reverse: buildReverseDict(data) };
    s_translationsCache[locale] = entry;
    callback(entry);
  });
}

function catalogSections(catalog) {
  var sections = (catalog && catalog.catalog && catalog.catalog.sections) || [];
  var map = {};
  var i, j, items;
  for (i = 0; i < sections.length; i++) {
    items = (sections[i] && sections[i].items) || [];
    for (j = 0; j < items.length; j++) {
      if (items[j] && items[j].itemId) {
        map[items[j].itemId] = sections[i].sectionId;
      }
    }
  }
  return map;
}

// callback({ canonicalItemId: sectionId }); {} when the catalog can't be loaded.
function loadCatalogSections(locale, callback) {
  if (s_catalogSectionsCache[locale]) {
    callback(s_catalogSectionsCache[locale]);
    return;
  }
  xhrRequest('GET', LOCALES_BASE_URL + 'catalog.' + locale + '.json', {}, null, function (err, data) {
    var map = err ? {} : catalogSections(data);
    if (Object.keys(map).length) {
      s_catalogSectionsCache[locale] = map; // only cache a usable catalog; retry next sync otherwise
    }
    callback(map);
  });
}

// callback({ canonicalItemId: userSectionId }) for the items the user sorted
// into a section in this list; {} on failure (best-effort, not cached since
// the user can change it any time).
function loadUserSections(state, callback) {
  var headers = authHeaders(state);
  xhrRequest('GET', BRING_BASE + 'v2/bringlists/' + state.listUuid + '/details', headers, null,
    function (err, data) {
      var map = {};
      var i;
      if (!err && data && data.length) {
        for (i = 0; i < data.length; i++) {
          if (data[i] && data[i].itemId && data[i].userSectionId) {
            map[data[i].itemId] = data[i].userSectionId;
          }
        }
      }
      callback(map);
    });
}

// Sets item.sectionId on each item (null when unknown). Must run before the
// item ids are translated, since both sources use the canonical ids.
function assignSections(list, userSections, catalogSections) {
  var i, id;
  for (i = 0; i < list.length; i++) {
    if (!list[i]) { continue; }
    id = list[i].itemId;
    list[i].sectionId = (Object.prototype.hasOwnProperty.call(userSections, id) && userSections[id]) ||
      (Object.prototype.hasOwnProperty.call(catalogSections, id) && catalogSections[id]) || null;
  }
}

function storeTokens(state, data) {
  state.accessToken = data.access_token;
  state.tokenType = data.token_type || 'Bearer';
  state.expiresAt = Date.now() + (data.expires_in * 1000) - 30000;
}

function loginAndSave(state, callback) {
  login(state.email, state.password, function (err, data) {
    if (err || !data || !data.access_token) {
      callback(err || new Error('login failed'));
      return;
    }
    state.uuid = data.uuid;
    state.publicUuid = data.publicUuid;
    state.refreshToken = data.refresh_token;
    storeTokens(state, data);
    saveState(state);
    callback(null, state);
  });
}

// Makes sure `state` has a non-expired access token, refreshing or
// re-logging in as needed, then hands the up-to-date state to `callback`.
function ensureAuth(callback) {
  var state = loadState();
  if (!state.email || !state.password || !state.listUuid) {
    callback(new Error('not configured'));
    return;
  }
  function withLocale(err, s) {
    if (err) { callback(err); return; }
    applyUserLocale(s, function (s2) { callback(null, s2); });
  }
  if (state.accessToken && state.expiresAt > Date.now()) {
    withLocale(null, state);
    return;
  }
  if (!state.refreshToken) {
    loginAndSave(state, withLocale);
    return;
  }
  refreshToken(state, function (err, data) {
    if (!err && data && data.access_token) {
      storeTokens(state, data);
      saveState(state);
      withLocale(null, state);
    } else if (err && !isLoginRejected(err)) {
      // No connection: a full login would fail the same way.
      callback(err);
    } else {
      loginAndSave(state, withLocale);
    }
  });
}

function loadLists(state, callback) {
  var headers = authHeaders(state);
  xhrRequest('GET', BRING_BASE + 'bringusers/' + state.uuid + '/lists', headers, null, function (err, data) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, (data && data.lists) || []);
  });
}

// Bring! answers a wrong email or password with a 4xx; anything else
// (status 0 = no connection/timeout, 5xx) is a connection problem.
function isLoginRejected(err) {
  return !!(err && err.status >= 400 && err.status < 500);
}

// The user hasn't allowed Brebble! internet access in the Pebble app (yet).
function isPermissionMissing(err) {
  return !!(err && err.permission);
}

// checkAccount's reason for a request that failed without a login rejection.
function connectReason(err) {
  return isPermissionMissing(err) ? 'permission' : 'connect';
}

// Picks the list to show: the one named `wanted` (case-insensitive), or the
// account's default list when `wanted` is empty. null when not found.
function pickList(lists, wanted, defaultListUuid) {
  var i;
  if (wanted) {
    for (i = 0; i < lists.length; i++) {
      if (String(lists[i].name).toLowerCase() === wanted.toLowerCase()) {
        return lists[i];
      }
    }
    return null;
  }
  for (i = 0; i < lists.length; i++) {
    if (lists[i].listUuid === defaultListUuid) {
      return lists[i];
    }
  }
  return lists[0] || null;
}

// Logs in with the given credentials and looks up the list, without storing
// anything. Used by "Test connection", by "Save" and by the sync when the
// list has not been resolved yet. Runs in PebbleKit JS (not the settings
// webview) because Bring!'s API rejects browser-origin (CORS) requests.
//
// callback(result): result.ok, result.reason ('login' | 'connect' |
// 'permission' | 'no_lists' | 'list_not_found'), result.lists (names), and
// when ok, result.state (session + listUuid/listName, ready for saveState).
function checkAccount(email, password, wantedListName, callback) {
  login(email, password, function (err, data) {
    if (err || !data || !data.access_token) {
      callback({ ok: false, reason: isLoginRejected(err) ? 'login' : connectReason(err), lists: [] });
      return;
    }
    var state = {
      email: email,
      password: password,
      uuid: data.uuid,
      publicUuid: data.publicUuid,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresAt: Date.now() + (data.expires_in * 1000) - 30000
    };
    applyUserLocale(state, function (state2) {
      loadLists(state2, function (err2, lists) {
        if (err2) {
          callback({ ok: false, reason: connectReason(err2), lists: [] });
          return;
        }
        var names = lists.map(function (l) { return String(l.name); });
        if (!lists.length) {
          callback({ ok: false, reason: 'no_lists', lists: names });
          return;
        }
        var chosen = pickList(lists, wantedListName, data.bringListUUID);
        if (!chosen) {
          callback({ ok: false, reason: 'list_not_found', lists: names });
          return;
        }
        state2.listUuid = chosen.listUuid;
        state2.listName = String(chosen.name);
        callback({ ok: true, lists: names, listName: state2.listName, state: state2 });
      });
    }, false);
  });
}

function translateItemIds(list, forwardDict) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i] && list[i].itemId && forwardDict[list[i].itemId]) {
      list[i].itemId = forwardDict[list[i].itemId];
    }
  }
}

// callback(err, { purchase: [...], recently: [...] }); each item has its
// (translated) itemId and its sectionId (see assignSections).
function getListItems(state, callback) {
  var headers = authHeaders(state);
  xhrRequest('GET', BRING_BASE + 'v2/bringlists/' + state.listUuid, headers, null, function (err, data) {
    if (err) {
      callback(err);
      return;
    }
    var items = (data && data.items) || { purchase: [], recently: [] };
    items.purchase = items.purchase || [];
    items.recently = items.recently || [];
    var locale = state.locale || BRING_DEFAULT_LOCALE;
    loadUserSections(state, function (userSections) {
      loadCatalogSections(locale, function (sections) {
        assignSections(items.purchase, userSections, sections);
        assignSections(items.recently, userSections, sections);
        loadTranslations(locale, function (dict) {
          translateItemIds(items.purchase, dict.forward);
          translateItemIds(items.recently, dict.forward);
          callback(null, items);
        });
      });
    });
  });
}

// operation: 'TO_PURCHASE' (add / move back to the shopping list),
//            'TO_RECENTLY' (mark as bought / completed)
// specification: the item's details ("500 ml"), '' for none. Bring! stores
// whatever is sent, so pass the current details to keep them.
function updateItem(state, itemName, operation, specification, callback) {
  // itemName may be a translated catalog name (e.g. "Coffee" shown on the
  // watch); Bring! only recognizes the German canonical id ("Kaffee") server
  // side, so it has to be translated back before sending. Free-typed items
  // just pass through unchanged since they won't be in the reverse dict.
  loadTranslations(state.locale || BRING_DEFAULT_LOCALE, function (dict) {
    var canonicalId = dict.reverse[itemName] || itemName;
    var headers = authHeaders(state);
    headers['Content-Type'] = 'application/json';
    var body = JSON.stringify({
      changes: [{
        accuracy: '0.0',
        altitude: '0.0',
        latitude: '0.0',
        longitude: '0.0',
        itemId: canonicalId,
        spec: specification || '',
        uuid: null,
        operation: operation
      }],
      sender: ''
    });
    xhrRequest('PUT', BRING_BASE + 'v2/bringlists/' + state.listUuid + '/items', headers, body, callback);
  });
}

module.exports = {
  BRING_DEFAULT_LOCALE: BRING_DEFAULT_LOCALE,
  loadState: loadState,
  saveState: saveState,
  loadWantedListName: loadWantedListName,
  saveCredentials: saveCredentials,
  saveLastCheck: saveLastCheck,
  loadLastCheck: loadLastCheck,
  isLoginRejected: isLoginRejected,
  isPermissionMissing: isPermissionMissing,
  PERMISSION_QUERY_TIMEOUT_MS: PERMISSION_QUERY_TIMEOUT_MS,
  pickList: pickList,
  checkAccount: checkAccount,
  ensureAuth: ensureAuth,
  getListItems: getListItems,
  catalogSections: catalogSections,
  assignSections: assignSections,
  updateItem: updateItem
};
