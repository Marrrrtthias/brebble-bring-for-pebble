// Builds the phone-side settings page: a self-contained data: URI, no server
// required.
//
// The page cannot talk to Bring! itself: Bring!'s API rejects browser-origin
// (CORS) requests, so every network call happens in PebbleKit JS. The page
// only collects input and hands it back via pebblejs://close#<json>, with
// `action` set to:
//   'test' - PebbleKit JS checks the entered login and list without storing
//            anything, then opens this page again showing the result (and the
//            values the user was editing, so nothing has to be retyped).
//   'save' - PebbleKit JS stores the values right away (they are kept even if
//            the following check fails), checks them and syncs the watch.
// An empty password means "keep the saved password". The saved password is
// never put into the page. `touchDisabled` (boolean) is the watch setting that
// turns off touch input on watches with a touchscreen.

var Locale = require('./locale');

var TEXTS = {
  en: {
    title: 'Brebble settings',
    intro: 'Connect your Bring! account. Your email and password are stored only in the Pebble app on this phone, so the list can sync in the background.',
    email: 'Email',
    password: 'Password',
    passwordSaved: 'Saved (leave empty to keep it)',
    showPassword: 'Show password',
    listName: 'List name (optional)',
    listPlaceholder: 'Empty = your default list',
    test: 'Test connection',
    testHint: 'The page closes for a moment while your phone checks the account, then opens again with the result.',
    save: 'Save',
    working: 'Please wait…',
    needEmail: 'Enter your email.',
    needPassword: 'Enter your password.',
    statusTest: 'Test result',
    statusSaved: 'Saved settings',
    ok: 'Connected to the list “%s”.',
    notSavedYet: 'Not saved yet: tap Save to use these settings.',
    errLogin: 'Bring! did not accept this email and password.',
    errConnect: 'Could not reach Bring!. Check the phone’s internet connection and try again.',
    errNoLists: 'This Bring! account has no lists.',
    errListNotFound: 'This account has no list named “%s”.',
    yourLists: 'Your lists (tap to pick one):',
    watchSection: 'Watch',
    disableTouch: 'Disable touch',
    disableTouchHint: 'For watches with a touchscreen: taps no longer check off items by accident. Use the buttons instead.'
  },
  es: {
    title: 'Ajustes de Brebble',
    intro: 'Conecta tu cuenta de Bring!. Tu email y contraseña se guardan solo en la app Pebble de este teléfono, para sincronizar la lista en segundo plano.',
    email: 'Email',
    password: 'Contraseña',
    passwordSaved: 'Guardada (vacío = sin cambios)',
    showPassword: 'Mostrar contraseña',
    listName: 'Nombre de la lista (opcional)',
    listPlaceholder: 'Vacío = tu lista principal',
    test: 'Probar conexión',
    testHint: 'La página se cierra un momento mientras el teléfono comprueba la cuenta y luego se vuelve a abrir con el resultado.',
    save: 'Guardar',
    working: 'Un momento…',
    needEmail: 'Introduce tu email.',
    needPassword: 'Introduce tu contraseña.',
    statusTest: 'Resultado de la prueba',
    statusSaved: 'Ajustes guardados',
    ok: 'Conectado a la lista «%s».',
    notSavedYet: 'Aún no se ha guardado: pulsa Guardar para usar estos ajustes.',
    errLogin: 'Bring! no aceptó este email y contraseña.',
    errConnect: 'No se pudo conectar con Bring!. Revisa la conexión a internet del teléfono e inténtalo de nuevo.',
    errNoLists: 'Esta cuenta de Bring! no tiene listas.',
    errListNotFound: 'Esta cuenta no tiene ninguna lista llamada «%s».',
    yourLists: 'Tus listas (pulsa para elegir una):',
    watchSection: 'Reloj',
    disableTouch: 'Desactivar el táctil',
    disableTouchHint: 'Para relojes con pantalla táctil: tocar ya no marca artículos por error. Usa los botones.'
  },
  de: {
    title: 'Brebble-Einstellungen',
    intro: 'Verbinde dein Bring!-Konto. E-Mail und Passwort werden nur in der Pebble-App auf diesem Handy gespeichert, damit die Liste im Hintergrund synchronisiert werden kann.',
    email: 'E-Mail',
    password: 'Passwort',
    passwordSaved: 'Gespeichert (leer = unverändert)',
    showPassword: 'Passwort anzeigen',
    listName: 'Listenname (optional)',
    listPlaceholder: 'Leer = deine Standardliste',
    test: 'Verbindung testen',
    testHint: 'Die Seite schließt sich kurz, während das Handy das Konto prüft, und öffnet sich dann mit dem Ergebnis wieder.',
    save: 'Speichern',
    working: 'Einen Moment…',
    needEmail: 'Gib deine E-Mail-Adresse ein.',
    needPassword: 'Gib dein Passwort ein.',
    statusTest: 'Testergebnis',
    statusSaved: 'Gespeicherte Einstellungen',
    ok: 'Verbunden mit der Liste „%s“.',
    notSavedYet: 'Noch nicht gespeichert: Tippe auf Speichern, um diese Einstellungen zu verwenden.',
    errLogin: 'Bring! hat diese E-Mail und dieses Passwort nicht akzeptiert.',
    errConnect: 'Bring! ist nicht erreichbar. Prüfe die Internetverbindung des Handys und versuche es erneut.',
    errNoLists: 'Dieses Bring!-Konto hat keine Listen.',
    errListNotFound: 'In diesem Konto gibt es keine Liste namens „%s“.',
    yourLists: 'Deine Listen (zum Auswählen antippen):',
    watchSection: 'Uhr',
    disableTouch: 'Touch deaktivieren',
    disableTouchHint: 'Für Uhren mit Touchscreen: Antippen hakt keine Artikel mehr versehentlich ab. Nutze stattdessen die Tasten.'
  },
  fr: {
    title: 'Paramètres Brebble',
    intro: 'Connectez votre compte Bring!. Votre e-mail et mot de passe sont stockés uniquement dans l’appli Pebble de ce téléphone, pour synchroniser la liste en arrière-plan.',
    email: 'E-mail',
    password: 'Mot de passe',
    passwordSaved: 'Enregistré (vide = inchangé)',
    showPassword: 'Afficher le mot de passe',
    listName: 'Nom de la liste (facultatif)',
    listPlaceholder: 'Vide = votre liste par défaut',
    test: 'Tester la connexion',
    testHint: 'La page se ferme un instant pendant que le téléphone vérifie le compte, puis se rouvre avec le résultat.',
    save: 'Enregistrer',
    working: 'Un instant…',
    needEmail: 'Saisissez votre e-mail.',
    needPassword: 'Saisissez votre mot de passe.',
    statusTest: 'Résultat du test',
    statusSaved: 'Paramètres enregistrés',
    ok: 'Connecté à la liste « %s ».',
    notSavedYet: 'Pas encore enregistré : appuyez sur Enregistrer pour utiliser ces paramètres.',
    errLogin: 'Bring! n’a pas accepté cet e-mail et ce mot de passe.',
    errConnect: 'Impossible de joindre Bring!. Vérifiez la connexion internet du téléphone et réessayez.',
    errNoLists: 'Ce compte Bring! n’a aucune liste.',
    errListNotFound: 'Ce compte n’a aucune liste nommée « %s ».',
    yourLists: 'Vos listes (appuyez pour en choisir une) :',
    watchSection: 'Montre',
    disableTouch: 'Désactiver le tactile',
    disableTouchHint: 'Pour les montres à écran tactile : un appui ne coche plus d’article par erreur. Utilisez les boutons.'
  },
  it: {
    title: 'Impostazioni di Brebble',
    intro: 'Collega il tuo account Bring!. Email e password sono salvate solo nell’app Pebble su questo telefono, per sincronizzare la lista in background.',
    email: 'Email',
    password: 'Password',
    passwordSaved: 'Salvata (vuota = invariata)',
    showPassword: 'Mostra password',
    listName: 'Nome della lista (facoltativo)',
    listPlaceholder: 'Vuoto = la tua lista predefinita',
    test: 'Prova connessione',
    testHint: 'La pagina si chiude per un momento mentre il telefono controlla l’account, poi si riapre con il risultato.',
    save: 'Salva',
    working: 'Un momento…',
    needEmail: 'Inserisci la tua email.',
    needPassword: 'Inserisci la tua password.',
    statusTest: 'Risultato della prova',
    statusSaved: 'Impostazioni salvate',
    ok: 'Connesso alla lista «%s».',
    notSavedYet: 'Non ancora salvato: tocca Salva per usare queste impostazioni.',
    errLogin: 'Bring! non ha accettato questa email e password.',
    errConnect: 'Impossibile raggiungere Bring!. Controlla la connessione internet del telefono e riprova.',
    errNoLists: 'Questo account Bring! non ha liste.',
    errListNotFound: 'Questo account non ha nessuna lista chiamata «%s».',
    yourLists: 'Le tue liste (tocca per sceglierne una):',
    watchSection: 'Orologio',
    disableTouch: 'Disattiva il touch',
    disableTouchHint: 'Per orologi con touchscreen: un tocco non spunta più gli articoli per sbaglio. Usa i pulsanti.'
  },
  pt: {
    title: 'Configurações do Brebble',
    intro: 'Conecte sua conta do Bring!. Seu e-mail e senha ficam salvos apenas no app Pebble deste telefone, para sincronizar a lista em segundo plano.',
    email: 'E-mail',
    password: 'Senha',
    passwordSaved: 'Salva (vazio = sem alterar)',
    showPassword: 'Mostrar senha',
    listName: 'Nome da lista (opcional)',
    listPlaceholder: 'Vazio = sua lista padrão',
    test: 'Testar conexão',
    testHint: 'A página fecha por um momento enquanto o telefone verifica a conta e depois abre de novo com o resultado.',
    save: 'Salvar',
    working: 'Um momento…',
    needEmail: 'Digite seu e-mail.',
    needPassword: 'Digite sua senha.',
    statusTest: 'Resultado do teste',
    statusSaved: 'Configurações salvas',
    ok: 'Conectado à lista “%s”.',
    notSavedYet: 'Ainda não salvo: toque em Salvar para usar estas configurações.',
    errLogin: 'O Bring! não aceitou este e-mail e senha.',
    errConnect: 'Não foi possível acessar o Bring!. Verifique a conexão com a internet do telefone e tente de novo.',
    errNoLists: 'Esta conta do Bring! não tem listas.',
    errListNotFound: 'Esta conta não tem nenhuma lista chamada “%s”.',
    yourLists: 'Suas listas (toque para escolher uma):',
    watchSection: 'Relógio',
    disableTouch: 'Desativar o toque',
    disableTouchHint: 'Para relógios com tela sensível ao toque: tocar não marca mais itens por engano. Use os botões.'
  }
};

// Picks the page language: the watch's language when known (sent by the
// watch with each sync request, e.g. "de_DE"), else the phone's, else English.
function pickLanguage(watchLocale) {
  var phoneLocale = (typeof navigator !== 'undefined' && navigator.language) || '';
  return Locale.pickSupported([watchLocale, phoneLocale], TEXTS, 'en');
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fill(template, value) {
  return template.replace('%s', escapeHtml(value));
}

var CSS = '' +
  ':root{--bg:#f4f4f6;--card:#fff;--text:#1d1d1f;--muted:#6b6b72;--line:#d6d6dc;' +
  '--accent:#e94e3c;--accent-text:#fff;--ok-bg:#e7f6ec;--ok:#1d7a3e;--err-bg:#fdecea;--err:#b3261e;}' +
  '@media (prefers-color-scheme:dark){:root{--bg:#111113;--card:#1e1e21;--text:#f2f2f5;' +
  '--muted:#a0a0a8;--line:#3a3a40;--ok-bg:#12301d;--ok:#7bd99a;--err-bg:#3a1714;--err:#ff9a8f;}}' +
  '*{box-sizing:border-box;}' +
  'body{margin:0;padding:16px;background:var(--bg);color:var(--text);' +
  'font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
  'main{max-width:480px;margin:0 auto;}' +
  'h1{font-size:22px;margin:4px 0 6px;}' +
  '.intro{font-size:14px;color:var(--muted);margin:0 0 16px;}' +
  '.card{background:var(--card);border-radius:12px;padding:16px;margin-bottom:16px;}' +
  'label{display:block;font-size:14px;font-weight:600;margin:0 0 6px;}' +
  '.field{margin-bottom:16px;}.field:last-child{margin-bottom:0;}' +
  'input[type=email],input[type=password],input[type=text]{width:100%;padding:12px;font-size:16px;' +
  'color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;}' +
  'input:focus{outline:2px solid var(--accent);outline-offset:-1px;}' +
  '.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 10px;color:var(--muted);}' +
  '.card .check{margin-top:0;color:var(--text);}' +
  '.check{display:flex;align-items:center;gap:8px;font-weight:400;margin-top:8px;color:var(--muted);}' +
  '.status{border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:15px;}' +
  '.status.ok{background:var(--ok-bg);color:var(--ok);}' +
  '.status.err{background:var(--err-bg);color:var(--err);}' +
  '.status h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px;opacity:.8;}' +
  '.status .who{text-transform:none;letter-spacing:0;}' +
  '.status p{margin:4px 0 0;}' +
  '.lists{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}' +
  '.chip{font:inherit;font-size:14px;padding:6px 12px;border-radius:999px;cursor:pointer;' +
  'border:1px solid currentColor;background:transparent;color:inherit;}' +
  '.actions{display:flex;flex-direction:column;gap:10px;}' +
  '.btn{font:inherit;font-weight:600;width:100%;padding:14px;border-radius:10px;cursor:pointer;}' +
  '.btn.primary{background:var(--accent);color:var(--accent-text);border:none;}' +
  '.btn.secondary{background:transparent;color:var(--accent);border:1.5px solid var(--accent);}' +
  '.btn:disabled{opacity:.6;}' +
  '.hint{font-size:13px;color:var(--muted);margin:4px 0 0;}' +
  '#problem{color:var(--err);font-size:14px;margin:0 0 12px;min-height:0;}';

function statusHtml(check, t) {
  if (!check) {
    return '';
  }
  var heading = escapeHtml(check.test ? t.statusTest : t.statusSaved);
  if (check.email) {
    heading += ' · <span class="who">' + escapeHtml(check.email) + '</span>';
  }
  var message;
  if (check.ok) {
    message = fill(t.ok, check.listName || '');
  } else if (check.reason === 'login') {
    message = escapeHtml(t.errLogin);
  } else if (check.reason === 'no_lists') {
    message = escapeHtml(t.errNoLists);
  } else if (check.reason === 'list_not_found') {
    message = fill(t.errListNotFound, check.wantedListName || '');
  } else {
    message = escapeHtml(t.errConnect);
  }
  var html = '<section class="status ' + (check.ok ? 'ok' : 'err') + '" id="status" role="status">' +
    '<h2>' + heading + '</h2><p>' + message + '</p>';
  if (check.ok && check.test) {
    html += '<p>' + escapeHtml(t.notSavedYet) + '</p>';
  }
  var lists = check.lists || [];
  if (lists.length > 1 || (lists.length && !check.ok)) {
    html += '<p>' + escapeHtml(t.yourLists) + '</p><div class="lists">';
    for (var i = 0; i < lists.length; i++) {
      html += '<button type="button" class="chip" data-list="' + escapeHtml(lists[i]) + '">' +
        escapeHtml(lists[i]) + '</button>';
    }
    html += '</div>';
  }
  return html + '</section>';
}

// Runs inside the webview, so it sticks to ES5 for old phone browsers.
var SCRIPT = '' +
  'var HAS_PASSWORD = __HAS_PASSWORD__;' +
  'var TEXT = __TEXT__;' +
  'function $(id) { return document.getElementById(id); }' +
  'function returnTo() {' +
  '  var vars = location.search.substring(1).split("&");' +
  '  for (var i = 0; i < vars.length; i++) {' +
  '    var pair = vars[i].split("=");' +
  '    if (pair[0] === "return_to") { return decodeURIComponent(pair[1]); }' +
  '  }' +
  '  return "pebblejs://close#";' +
  '}' +
  'function submit(action) {' +
  '  var email = $("email").value.replace(/^\\s+|\\s+$/g, "");' +
  '  var password = $("password").value;' +
  '  var listName = $("listName").value.replace(/^\\s+|\\s+$/g, "");' +
  '  var problem = !email ? TEXT.needEmail : (!password && !HAS_PASSWORD ? TEXT.needPassword : "");' +
  '  $("problem").textContent = problem;' +
  '  if (problem) { $(!email ? "email" : "password").focus(); return; }' +
  '  var button = $(action);' +
  '  $("test").disabled = true; $("save").disabled = true;' +
  '  button.textContent = TEXT.working;' +
  '  var payload = { action: action, email: email, password: password, listName: listName,' +
  '    touchDisabled: $("touchDisabled").checked };' +
  '  location.href = returnTo() + encodeURIComponent(JSON.stringify(payload));' +
  '}' +
  '$("test").onclick = function () { submit("test"); };' +
  '$("save").onclick = function () { submit("save"); };' +
  '$("form").onsubmit = function (e) { e.preventDefault(); submit("save"); };' +
  '$("show").onchange = function () { $("password").type = this.checked ? "text" : "password"; };' +
  'var chips = document.querySelectorAll(".chip");' +
  'for (var i = 0; i < chips.length; i++) {' +
  '  chips[i].onclick = function () { $("listName").value = this.getAttribute("data-list"); };' +
  '}';

// options: { email, listName, password (only a value the user just typed,
// never the saved one), hasPassword, touchDisabled, locale, check }
function buildSettingsUrl(options) {
  var o = options || {};
  var lang = pickLanguage(o.locale);
  var t = TEXTS[lang];
  var hasPassword = !!o.hasPassword;

  var body = '' +
    '<main><h1>' + escapeHtml(t.title) + '</h1>' +
    '<p class="intro">' + escapeHtml(t.intro) + '</p>' +
    statusHtml(o.check, t) +
    '<form id="form" class="card" novalidate>' +
    '<div class="field"><label for="email">' + escapeHtml(t.email) + '</label>' +
    '<input id="email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="' +
    escapeHtml(o.email || '') + '"></div>' +
    '<div class="field"><label for="password">' + escapeHtml(t.password) + '</label>' +
    '<input id="password" type="password" autocomplete="current-password" value="' + escapeHtml(o.password || '') + '"' +
    (hasPassword ? ' placeholder="' + escapeHtml(t.passwordSaved) + '"' : '') + '>' +
    '<label class="check"><input id="show" type="checkbox"> ' + escapeHtml(t.showPassword) + '</label></div>' +
    '<div class="field"><label for="listName">' + escapeHtml(t.listName) + '</label>' +
    '<input id="listName" type="text" autocomplete="off" placeholder="' + escapeHtml(t.listPlaceholder) + '" value="' +
    escapeHtml(o.listName || '') + '"></div>' +
    '<input type="submit" hidden>' +
    '</form>' +
    '<section class="card"><h2>' + escapeHtml(t.watchSection) + '</h2>' +
    '<label class="check"><input id="touchDisabled" type="checkbox"' + (o.touchDisabled ? ' checked' : '') + '> ' +
    escapeHtml(t.disableTouch) + '</label>' +
    '<p class="hint">' + escapeHtml(t.disableTouchHint) + '</p></section>' +
    '<p id="problem" role="alert"></p>' +
    '<div class="actions">' +
    '<button type="button" id="save" class="btn primary">' + escapeHtml(t.save) + '</button>' +
    '<button type="button" id="test" class="btn secondary">' + escapeHtml(t.test) + '</button>' +
    '<p class="hint">' + escapeHtml(t.testHint) + '</p>' +
    '</div></main>';

  // Only what the script needs, with "<" escaped so text can't close the tag.
  var scriptText = { needEmail: t.needEmail, needPassword: t.needPassword, working: t.working };
  var script = SCRIPT
    .replace('__HAS_PASSWORD__', hasPassword ? 'true' : 'false')
    .replace('__TEXT__', JSON.stringify(scriptText).replace(/</g, '\\u003c'));

  var html = '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(t.title) + '</title><style>' + CSS + '</style></head><body>' +
    body + '<script>' + script + '</script></body></html>';
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
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
  TEXTS: TEXTS,
  buildSettingsUrl: buildSettingsUrl,
  parseConfigResponse: parseConfigResponse
};
