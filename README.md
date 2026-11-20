# Brebble! Bring for pebble

> **Unofficial.** Brebble is not affiliated with, endorsed by or sponsored by
> Bring! Labs AG. "Bring!" is a trademark of its respective owner and is used
> here only to describe which service this app works with.

> **Fork.** This is a fork of
> [aiorass/bring_pebble](https://github.com/aiorass/bring_pebble), which seems to be no
> longer maintained. See [Credits](#credits-and-license).

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
`TEXTS` in `src/pkjs/config.js`, and optionally a keyword list for that
language in `src/pkjs/categorize.js` (icon guess for free-typed items).

## How it works

- **`src/c/bring_pebble.c`**: the watch UI. A `MenuLayer` with "+ Add item" at
  the top (voice dictation) and the list below (`[ ]`/`[x]` depending on
  whether it was bought). Selecting an item toggles it; holding SELECT 
  reloads the list from Bring!.
- **`src/pkjs/`**: the phone bridge (PebbleKit JS). The watch *never* talks to
  Bring! directly; it only exchanges short `AppMessage`s with the phone, which
  makes the HTTPS calls to `api.getbring.com`.
  - `bring-api.js`: Bring! API client (login, token refresh, read list with
    each item's section, add/complete/restore items).
  - `config.js`: builds the settings page (login, list name, connection
    test) that opens in the phone's browser.
  - `categorize.js`: maps an item's Bring! section to its icon, with a
    keyword-based guess for items without a section.
  - `index.js`: ties everything together, handling watch messages and
    configuration events.

## Setting up your account

1. Install the app on the watch (see below).
2. On the phone, open the Pebble app → this app → **Settings**.
3. Enter your Bring! email and password, and optionally a list name (empty =
   your default list).
4. Tap **Test connection** to check them: the page closes for a moment while
   the phone logs in, then opens again showing whether it worked, which list
   was found and all lists of the account (tap one to pick it). Testing does
   not save anything.
5. Tap **Save**. The watch syncs automatically as soon as the settings are
   saved. The next time you open Settings, it shows the result of the last
   check of the saved settings.

The settings page can't call Bring! itself (Bring!'s API rejects requests
from a browser), so the test runs in the Pebble app's JavaScript and the page
is reopened with the result. If your Pebble app doesn't reopen it, open
Settings again to see the result.

Saved settings are kept until you change them: a failed login or a network
error never removes them, and if the list could not be looked up while
saving, the next sync tries again. To keep the saved password, leave the
password field empty.

The email and password are stored only in the Pebble app's `localStorage` on
that phone (they are never sent to the watch, and the saved password is never
put into the settings page). The password is used to log in
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

The JS tests cover item sections and icons, locale handling, text truncation and
the configuration page, and check that constants shared between the watch (C)
and the phone (JS) still match. The C test checks every language's string
table: no missing strings, exactly one `%s` in the list-not-found message,
and that it fits the watch's message buffer.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and builds the
`.pbw` for all platforms on every pull request and push to `main`; the built
`.pbw` is attached to the run as an artifact (the file itself, not a zip).

## Releases

Built `.pbw` files are attached to each
[GitHub release](https://github.com/Marrrrtthias/brebble-bring-for-pebble/releases). A
release is created automatically when a `v*` tag is pushed (see
`.github/workflows/release.yml`). Once that succeeds, a separate workflow downloads
the released `.pbw` and publishes it immediately to the
[Pebble app store](https://apps.repebble.com/5403660269af4a0087f0cf95).
Existing store screenshots and listing metadata are left unchanged.

Store release notes come from the `## Version <version>` section in
[`store/CHANGELOG.md`](store/CHANGELOG.md) matching `package.json`, not from the
entire changelog or the generated GitHub release notes. A missing, duplicate or
empty section fails the release before building.

Version 2.0.0 uses a new app UUID, so it installs next to the original app
instead of replacing it, and the settings must be entered again.

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
- **Item icons**: each item shows the icon of its Bring! section (fruit &
  vegetables, bread & pastries, milk & cheese, meat & fish, ingredients &
  spices, frozen & convenience, grain products, snacks & sweets, beverages,
  household, care & health, pet supplies, home & garden). The section comes
  from the section you assigned the item to in that list, otherwise from
  Bring!'s public item catalog for your account's locale
  (`catalog.<locale>.json`), the same data the Bring! apps sort by.
  Free-typed items you never sorted into a section have none; for those the
  icon is guessed from keywords in the language of your Bring! account (or
  German, Bring!'s catalog language, when the account language can't be
  determined). Only that language's keywords are used, so a name in another
  language, an unrecognized name, or any such item on an account in a language
  without keywords (e.g. Dutch) gets the default icon. Matching depends on the
  language: German matches keywords at the end of a word (compounds such as
  "Vollmilch"), all other languages match whole words including common plural
  forms ("tomatoes", "limones"). German, French, Italian and Portuguese have
  short keyword lists so far; Spanish and English are the most complete.

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

## Credits and license

Brebble is a fork of [aiorass/bring_pebble](https://github.com/aiorass/bring_pebble)
(c) 2026 aiorass, with changes (c) 2026 Matthias Gellrich. Both parts are
released under the [MIT License](LICENSE).

The Bring! API client builds on the community work in
[miaucl/bring-api](https://github.com/miaucl/bring-api).
