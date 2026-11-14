# Name Garden

A shared baby-name chooser for two people. Keep a shortlist, rate names independently,
compare every pair, and discuss a final double-elimination tournament. Participants,
name lists and optional research are configuration files.

The default preset starts with eight sample names, neutral ratings and two generic
participant labels. An optional Russian/Brazilian Portuguese/English preset includes
248 names and the original project's research structure, with personal details and
preferences removed.

## Run locally

Use Node.js 22.13 or newer.

```sh
npm ci
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:5173>. The development server binds to loopback and permits
local access without a password. SQLite data persists in `.wrangler/state` through
Cloudflare's local D1 emulator. No account or hosted service is needed for development.

To test the password gate, copy `.dev.vars.example` to `.dev.vars`, set your own
password, and restart. The default username is `family`.

## Customize

Edit `config/app.json`, `config/names.json` and `config/research.json`. Start from either
included preset:

```sh
npm run configure -- starter
npm run configure -- ru-br-en
```

Preset selection replaces the three configuration files; it does not change saved
ratings, notes, leagues or tournaments. Back up your configuration before switching,
and use a fresh database for unrelated name lists. Keep name IDs stable when editing
an existing list. See [configuration](docs/CONFIGURATION.md).

## How choosing works

- Each participant has independent love, like, maybe, defer and veto ratings.
- Search and combinable filters narrow new proposals. Named views can preserve
  either criteria or an explicit selection across devices.
- A league freezes its roster and compares every unordered pair for each person.
  A win earns 3 points, a tie 1. Ten names take 45 comparisons per person.
- Partial standings remain provisional. Skipped pairs stay unanswered, votes are
  editable, and results never silently eliminate a name.
- Finals support 2–16 ordered entrants, byes, double elimination and a grand-final
  reset. Matching independent votes advance a name; disagreement waits for an
  explicit joint decision. The latest completed match can be undone.
- Notes, ratings, votes, tournaments and named views live in one shared D1 room.
  JSON and CSV exports provide backups. Device display preferences stay local.

The profiles identify whose preference is being entered; both people can select
either profile. This is one private room per deployment, not a multi-tenant service.

## Host a private room

The app uses React, Vinext/Vite and Cloudflare Workers with D1. It has no dependency
on Sites or ChatGPT login. Deployment is a separate action; these commands are for
your own Cloudflare account.

```sh
npx wrangler login
npx wrangler d1 create name-garden
```

Put the returned database ID in `wrangler.jsonc`, replacing the all-zero sample ID.
Then apply migrations, set a long private password and deploy:

```sh
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put NAME_GARDEN_PASSWORD
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

Use the HTTPS URL returned by Wrangler and sign in as `family`. To change the
username, add `NAME_GARDEN_USERNAME` to the worker's variables or secrets.
Every deployed request is password protected. A missing password fails closed;
caller-supplied identity headers do not authenticate a request. Mutations also
require a same-origin JSON request.

For a local production-build preview, configure `.dev.vars`, then run `npm run build`
and `npm start`. This serves the compiled worker on loopback with the password gate
enabled. Development and preview use the same local D1 persistence directory.

## Optional research example

The `ru-br-en` preset shows document spelling comparisons, pronunciation,
household forms, cultural-use evidence and source links. These are an optional,
language-specific example rather than requirements for choosing names. Its detailed
research interface and editorial notes are in Russian; the main chooser is in English.
The data describes selected evidence and recorded uncertainty. It does not write
preferences or league results.

The public example contains no family surname, personal ratings, conversation
archive, original workbook or private deployment identifiers. Linked source pages
remain separate from this repository; downloaded source documents are not bundled.

## Check

```sh
npm test
npm run typecheck
npm run build
```

Tests cover round-robin accounting, selection filters, idempotent creation,
revision conflicts, tournament transitions, configuration and the password boundary.
CI checks both presets.

## License

MIT. See [LICENSE](LICENSE).
