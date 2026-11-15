// Builds the phone-side configuration screen (a self-contained data: URI, no
// server required). This is a single screen on purpose: opening a *second*
// webview from inside the async callback that follows it (i.e. after the
// login network call finishes) is not reliably honored by the host app, so
// everything the user needs to enter has to fit on the one page that's
// already open. Bring!'s API also has no CORS headers and rejects requests
// from a browser/webview origin, so this page makes no network calls itself
// — it only collects input and hands it back via pebblejs://close#....

function pageShell(lang, title, bodyHtml, script) {
  return '' +
    '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<style>' +
    'body{font-family:sans-serif;margin:0;padding:16px;background:#fff;color:#222;}' +
    'h1{font-size:18px;}' +
    'p{font-size:13px;color:#555;}' +
    'label{display:block;margin-top:12px;font-size:13px;color:#555;}' +
    'input{width:100%;box-sizing:border-box;padding:8px;font-size:16px;margin-top:4px;}' +
    'button{margin-top:16px;width:100%;padding:12px;font-size:16px;background:#e94e3c;color:#fff;border:none;border-radius:4px;}' +
    '</style></head><body>' +
    '<h1>' + title + '</h1>' +
    bodyHtml +
    '<script>' + script + '</script>' +
    '</body></html>';
}

var TEXTS = {
  en: {
    title: 'Connect your Bring! account',
    intro: 'Your email and password are stored only in the Pebble app\'s local storage on this phone, so the list can sync in the background.',
    email: 'Email',
    password: 'Password',
    listName: 'List name (optional)',
    listPlaceholder: 'Leave empty = your default list',
    save: 'Save'
  },
  es: {
    title: 'Conecta tu cuenta de Bring!',
    intro: 'Tu email y contraseña se guardan solo en el almacenamiento local de la app Pebble en este teléfono, para poder sincronizar la lista en segundo plano.',
    email: 'Email',
    password: 'Contraseña',
    listName: 'Nombre de la lista (opcional)',
    listPlaceholder: 'Vacío = tu lista principal',
    save: 'Guardar'
  },
  de: {
    title: 'Bring!-Konto verbinden',
    intro: 'E-Mail und Passwort werden nur im lokalen Speicher der Pebble-App auf diesem Handy gespeichert, damit die Liste im Hintergrund synchronisiert werden kann.',
    email: 'E-Mail',
    password: 'Passwort',
    listName: 'Listenname (optional)',
    listPlaceholder: 'Leer = deine Standardliste',
    save: 'Speichern'
  },
  fr: {
    title: 'Connectez votre compte Bring!',
    intro: 'Votre e-mail et mot de passe sont stockés uniquement dans le stockage local de l\'appli Pebble sur ce téléphone, pour synchroniser la liste en arrière-plan.',
    email: 'E-mail',
    password: 'Mot de passe',
    listName: 'Nom de la liste (facultatif)',
    listPlaceholder: 'Vide = votre liste par défaut',
    save: 'Enregistrer'
  },
  it: {
    title: 'Collega il tuo account Bring!',
    intro: 'Email e password sono salvate solo nella memoria locale dell\'app Pebble su questo telefono, per sincronizzare la lista in background.',
    email: 'Email',
    password: 'Password',
    listName: 'Nome della lista (facoltativo)',
    listPlaceholder: 'Vuoto = la tua lista predefinita',
    save: 'Salva'
  },
  pt: {
    title: 'Conecte sua conta do Bring!',
    intro: 'Seu e-mail e senha ficam salvos apenas no armazenamento local do app Pebble neste telefone, para sincronizar a lista em segundo plano.',
    email: 'E-mail',
    password: 'Senha',
    listName: 'Nome da lista (opcional)',
    listPlaceholder: 'Vazio = sua lista padrão',
    save: 'Salvar'
  }
};

// Picks the page language: the watch's language when known (sent by the
// watch with each sync request, e.g. "de_DE"), else the phone's, else English.
function pickLanguage(watchLocale) {
  var candidates = [watchLocale, (typeof navigator !== 'undefined' && navigator.language) || ''];
  var i, code;
  for (i = 0; i < candidates.length; i++) {
    code = String(candidates[i] || '').substring(0, 2).toLowerCase();
    if (TEXTS[code]) {
      return code;
    }
  }
  return 'en';
}

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildCredentialsUrl(current) {
  var email = (current && current.email) || '';
  var listName = (current && current.listName) || '';
  var lang = pickLanguage(current && current.locale);
  var t = TEXTS[lang];

  var body = '' +
    '<p>' + t.intro + '</p>' +
    '<label>' + t.email + '<input id="email" type="email" autocapitalize="none" value="' + escapeAttr(email) + '"></label>' +
    '<label>' + t.password + '<input id="password" type="password"></label>' +
    '<label>' + t.listName + '<input id="listName" type="text" placeholder="' + escapeAttr(t.listPlaceholder) + '" value="' + escapeAttr(listName) + '"></label>' +
    '<button id="go">' + t.save + '</button>';

  var script = '' +
    'function bringGetReturnTo() {' +
    '  var query = location.search.substring(1);' +
    '  var vars = query.length ? query.split("&") : [];' +
    '  for (var i = 0; i < vars.length; i++) {' +
    '    var pair = vars[i].split("=");' +
    '    if (pair[0] === "return_to") { return decodeURIComponent(pair[1]); }' +
    '  }' +
    '  return "pebblejs://close#";' +
    '}' +
    'document.getElementById("go").onclick = function () {' +
    '  var email = document.getElementById("email").value.trim();' +
    '  var password = document.getElementById("password").value;' +
    '  var listName = document.getElementById("listName").value.trim();' +
    '  if (!email || !password) { return; }' +
    '  var payload = { email: email, password: password, listName: listName };' +
    '  location.href = bringGetReturnTo() + encodeURIComponent(JSON.stringify(payload));' +
    '};';

  return 'data:text/html;charset=utf-8,' + encodeURIComponent(pageShell(lang, t.title, body, script));
}

function parseConfigResponse(response) {
  try {
    return JSON.parse(decodeURIComponent(response));
  } catch (e1) {
    try {
      return JSON.parse(response);
    } catch (e2) {
      return null;
    }
  }
}

module.exports = {
  buildCredentialsUrl: buildCredentialsUrl,
  parseConfigResponse: parseConfigResponse
};
