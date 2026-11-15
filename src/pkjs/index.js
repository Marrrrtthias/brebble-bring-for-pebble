var BringApi = require('./bring-api');
var Config = require('./config');
var Categorize = require('./categorize');

var ACTION_REQUEST_SYNC = 0;
var ACTION_SYNC_ITEM = 1;
var ACTION_SYNC_DONE = 2;
var ACTION_TOGGLE_ITEM = 3;
var ACTION_ADD_ITEM = 4;
var ACTION_ERROR = 5;
var ACTION_NOT_CONFIGURED = 6;
var ACTION_SYNC_START = 7;

// Error codes sent to the watch, which renders them in its own language.
// Must match the BringError enum in src/c/bring_pebble.c
var ERR_CONNECT_BRING = 1;
var ERR_READ_LIST = 2;
var ERR_LOGIN = 3;
var ERR_NO_LISTS = 4;
var ERR_LIST_NOT_FOUND = 5;

var MAX_ITEMS = 80; // must match MAX_ITEMS in src/c/bring_pebble.c

function isConfigured() {
  var s = BringApi.loadState();
  return !!(s.email && s.password && s.listUuid);
}

function sendNotConfigured() {
  Pebble.sendAppMessage({ action: ACTION_NOT_CONFIGURED });
}

function sendError(code, detail) {
  var msg = { action: ACTION_ERROR, errorCode: code };
  if (detail) {
    msg.errorMsg = String(detail).substring(0, 60);
  }
  Pebble.sendAppMessage(msg);
}

function sendItemsThenDone(items, locale) {
  function afterStart() {
    var i = 0;
    function sendNext() {
      if (i >= items.length) {
        Pebble.sendAppMessage({ action: ACTION_SYNC_DONE });
        return;
      }
      var item = items[i];
      var index = i;
      Pebble.sendAppMessage(
        {
          action: ACTION_SYNC_ITEM,
          itemIndex: index,
          itemName: item.name,
          itemDone: item.done ? 1 : 0,
          itemIcon: Categorize.categorize(item.name, locale)
        },
        function () { i++; sendNext(); },
        function () { i++; sendNext(); } // best-effort: skip a dropped item instead of stalling the sync
      );
    }
    sendNext();
  }
  // Tells the watch to discard its current list before the new one streams
  // in, so a shrunk list (e.g. an item got completed) doesn't leave stale
  // rows behind.
  Pebble.sendAppMessage({ action: ACTION_SYNC_START }, afterStart, afterStart);
}

function doSync() {
  if (!isConfigured()) {
    var configError = BringApi.loadConfigError();
    if (configError) {
      sendError(configError.code, configError.detail);
    } else {
      sendNotConfigured();
    }
    return;
  }
  BringApi.ensureAuth(function (authErr, state) {
    if (authErr) {
      sendError(ERR_CONNECT_BRING);
      return;
    }
    BringApi.getListItems(state, function (err, items) {
      if (err) {
        sendError(ERR_READ_LIST);
        return;
      }
      var merged = [];
      var i;
      for (i = 0; i < items.purchase.length; i++) {
        merged.push({ name: items.purchase[i].itemId, done: false });
      }
      for (i = 0; i < items.recently.length; i++) {
        merged.push({ name: items.recently[i].itemId, done: true });
      }
      // Item names arrive in the Bring! account's language, so that decides
      // which keywords to use; the watch language is only a fallback.
      sendItemsThenDone(merged.slice(0, MAX_ITEMS), state.locale || currentWatchLocale());
    });
  });
}

Pebble.addEventListener('ready', function () {
  console.log('Bring! companion ready');
});

Pebble.addEventListener('appmessage', function (e) {
  var payload = e.payload;
  console.log('appmessage received, action=' + payload.action);

  if (payload.action === ACTION_REQUEST_SYNC) {
    if (payload.locale) {
      // Remember the watch's language so the config page can match it.
      localStorage.setItem('bring_watchLocale', String(payload.locale));
    }
    doSync();
    return;
  }

  if (payload.action === ACTION_TOGGLE_ITEM) {
    if (!isConfigured()) {
      sendNotConfigured();
      return;
    }
    var toggleOp = payload.itemDone ? 'TO_RECENTLY' : 'TO_PURCHASE';
    BringApi.ensureAuth(function (authErr, state) {
      if (authErr) {
        sendError(ERR_CONNECT_BRING);
        return;
      }
      BringApi.updateItem(state, payload.itemName, toggleOp, function () {
        // Re-sync regardless of success so the watch always reflects server state.
        doSync();
      });
    });
    return;
  }

  if (payload.action === ACTION_ADD_ITEM) {
    if (!isConfigured()) {
      sendNotConfigured();
      return;
    }
    var name = (payload.itemName || '').trim();
    if (!name) {
      doSync();
      return;
    }
    BringApi.ensureAuth(function (authErr, state) {
      if (authErr) {
        sendError(ERR_CONNECT_BRING);
        return;
      }
      BringApi.updateItem(state, name, 'TO_PURCHASE', function () {
        doSync();
      });
    });
  }
});

// The watch's current language, preferring the live value from the Pebble app
// over the one remembered from the last sync (the user may have changed the
// watch language since).
function currentWatchLocale() {
  try {
    var info = Pebble.getActiveWatchInfo && Pebble.getActiveWatchInfo();
    if (info && info.language) {
      return String(info.language);
    }
  } catch (e) {
    // No watch connected: fall through to the remembered value.
  }
  return localStorage.getItem('bring_watchLocale') || '';
}

Pebble.addEventListener('showConfiguration', function () {
  var current = BringApi.loadState();
  Pebble.openURL(Config.buildCredentialsUrl({
    email: current.email,
    listName: current.listName,
    locale: currentWatchLocale()
  }));
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e.response) {
    return; // user cancelled
  }
  var data = Config.parseConfigResponse(e.response);
  if (!data) {
    return;
  }
  var email = (data.email || '').trim();
  var password = data.password || '';
  var wantedListName = (data.listName || '').trim();
  if (!email || !password) {
    return;
  }

  // Login + list lookup happens here in pkjs (native networking), not in
  // the configuration webview, since Bring!'s API has no CORS headers and
  // blocks requests coming from a browser/webview origin.
  BringApi.authenticateAndListLists(email, password, function (err, state, lists, defaultListUuid) {
    if (err || !lists || !lists.length) {
      var code = err ? ERR_LOGIN : ERR_NO_LISTS;
      BringApi.saveConfigError(code);
      sendError(code); // reaches the watch if it happens to be open right now
      return;
    }

    var chosen = null;
    var i;
    if (wantedListName) {
      for (i = 0; i < lists.length; i++) {
        if (lists[i].name.toLowerCase() === wantedListName.toLowerCase()) {
          chosen = lists[i];
          break;
        }
      }
      if (!chosen) {
        BringApi.saveConfigError(ERR_LIST_NOT_FOUND, wantedListName);
        sendError(ERR_LIST_NOT_FOUND, wantedListName);
        return;
      }
    } else {
      for (i = 0; i < lists.length; i++) {
        if (lists[i].listUuid === defaultListUuid) {
          chosen = lists[i];
          break;
        }
      }
      if (!chosen) {
        chosen = lists[0];
      }
    }

    state.listUuid = chosen.listUuid;
    state.listName = chosen.name;
    BringApi.saveState(state);
    BringApi.clearConfigError();
    doSync();
  });
});
