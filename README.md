# Bring! for Pebble

A Pebble watchapp (including the 2026 Core Devices hardware: Pebble Time 2
"emery", Pebble Round 2 "gabbro" and Pebble 2 Duo "flint") that syncs with
your [Bring!](https://www.getbring.com/) shopping list.

Bring! has no official public API. This app uses the unofficial REST API
reverse-engineered by the community (the same one used by the
[Home Assistant](https://www.home-assistant.io/integrations/bring/)
integration, via [miaucl/bring-api](https://github.com/miaucl/bring-api)).
It may stop working if Bring! changes its backend.

## Languages

The app follows the language set on the watch. Supported: English (default and
fallback), Spanish, German, French, Italian and Portuguese.

- The watch UI, including error messages, is localized in
  `src/c/strings.c` (the `STRINGS` table). The language is read with
  `i18n_get_system_locale()`.
- The phone never sends error text, only error codes, so errors also appear in
  the watch's language.
- The configuration page uses the watch's language (sent with each sync
  request), falling back to the phone's language, then English.
- Catalog items are translated to the Bring! account's language (see below).

To add a language, add an entry to `STRINGS` in `src/c/strings.c` and to
`TEXTS` in `src/pkjs/config.js`, and optionally a keyword
list for that language in `src/pkjs/categorize.js`.

## How it works

- **`src/c/bring_pebble.c`**: the watch UI. A `MenuLayer` with "+ Add item" at
  the top (voice dictation) and the list below (`[ ]`/`[x]` depending on
  whether it was bought). Selecting an item toggles it.
- **`src/pkjs/`**: the phone bridge (PebbleKit JS). The watch *never* talks to
  Bring! directly; it only exchanges short `AppMessage`s with the phone, which
  makes the HTTPS calls to `api.getbring.com`.
  - `bring-api.js`: Bring! API client (login, token refresh, read list,
    add/complete/restore items).
  - `config.js`: builds the configuration screen (login + list selection)
    that opens in the phone's browser.
  - `categorize.js`: keyword-based icon category guess for list items.
  - `index.js`: ties everything together, handling watch messages and
    configuration events.

## Setting up your account

1. Install the app on the watch (see below).
2. On the phone, open the Pebble app → this app → **Settings**.
3. Enter your Bring! email and password, optionally a list name, and save.
4. The watch syncs automatically as soon as the settings are saved.

The email and password are stored only in the Pebble app's `localStorage` on
that phone (they are never sent to the watch). The password is used to log in
again when the refresh token expires; if that concerns you, it is easy to
change `bring-api.js` to not persist it and ask for the login again when the
refresh fails.

## Build and install

```sh
pebble build                          # builds all 7 platforms
pebble install --emulator emery       # try it in the emulator (Pebble Time 2)
pebble install --phone <ip>           # install on a paired, real watch
```

## Tests and CI

```sh
npm test          # all tests
npm run test:js   # phone-side unit tests (node --test, no dependencies)
npm run test:c    # watch string tables, compiled on the host with cc
```

The JS tests cover item categorization, locale handling, text truncation and
the configuration page, and check that constants shared between the watch (C)
and the phone (JS) still match. The C test checks every language's string
table: no missing strings, exactly one `%s` in the list-not-found message,
and that it fits the watch's message buffer.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and builds the
`.pbw` for all platforms on every pull request and push to `main`; the built
`.pbw` is attached to the run as an artifact.

## Known limitations

- **Round screens (chalk / gabbro)**: the "Shopping list" section title is
  clipped against the curved edge of the screen. This is a `MenuLayer` layout
  detail that still needs adjusting; the rest of the app works normally.
- **No text editing on the watch**: adding items uses voice dictation
  (`dictation_session`). On hardware without a microphone (aplite/basalt/
  chalk/diorite) this option will not work; the watch still shows and syncs
  the list.
- **Sync retries**: if the phone is slow to reconnect over Bluetooth, the
  watch retries the sync request every 4s, up to 6 times, before showing an
  error.
- **Catalog item translation**: items picked from the Bring! catalog (as
  opposed to typed by hand) are stored on the backend under a canonical German
  name and automatically translated to the account's language using Bring!'s
  public locale dictionary. This covers the most common languages (`es-ES`,
  `en-US`, `fr-FR`, etc.; see `BRING_SUPPORTED_LOCALES` in `bring-api.js`); a
  very specific regional variant not listed there may not be translated.
- **Item icons**: category icons are guessed from keywords in the language of
  your Bring! account (or German, Bring!'s catalog language, when the account
  language can't be determined). Only that language's keywords are used, so a
  name in another language, an unrecognized name, or any item on an account in
  a language without keywords (e.g. Dutch) gets the default icon. Matching depends on the
  language: German matches keywords at the end of a word (compounds such as
  "Vollmilch"), all other languages match whole words including common
  plural forms ("tomatoes", "limones"). German, French, Italian and
  Portuguese have short keyword lists so far; Spanish and English are the
  most complete.

## Tested

- `pebble build` compiles without errors on all 7 platforms.
- Localization was checked in the `emery` emulator by temporarily forcing
  each locale: accented characters (é, ó, è, ç, õ, ü, ö) render correctly in
  the message screens and in the menu rows and section header.
- The `AppMessage` round trip (watch ⇄ pkjs) was tested in the `emery`
  emulator: the watch requests a sync, the phone answers, and the watch shows
  the "not configured" state correctly.
- The full Bring! login/list flow was tested against the real API with a real
  account: login, automatic sync on app start, adding/checking/unchecking items
  (by hand and by voice) and catalog item translation all worked end to end.
