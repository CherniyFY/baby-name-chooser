# Configuration

The app bundles three active files at build time:

- `config/app.json`: title, description, two participant labels, empty or example family fields, and whether the optional research view is available.
- `config/names.json`: candidates and editorial details. Every initial rating is neutral.
- `config/research.json`: optional research indexed by candidate ID and the linked source catalogs.

The supplied configuration opens with eight illustrative names, neutral participants, blank family fields, and no research. It works without the original family's data or a Sites account. The main chooser is in English; the optional RU/BR/EN research interface and its editorial records are in Russian. `locale` identifies the preset language and does not translate editorial records automatically. The RU/BR/EN research fields remain a specialized optional example.

## Select an example

From the repository root:

```sh
node scripts/configure.mjs starter
node scripts/configure.mjs ru-br-en
```

The command validates the complete preset and replaces the three active files. Restart the development server or rebuild after selection. To check a preset without changing anything:

```sh
node scripts/configure.mjs ru-br-en --check
```

The RU/BR/EN example includes 248 candidates, document-spelling comparisons, cultural evidence, household forms, and pronunciation research. It contains no original participant ratings, personal family profile, original workbook formatting, conversations, or production database records. All participants start without a rating. Candidate IDs retain their original stable references so the research remains connected to the right names.

Select a preset before recording decisions. Each deployment contains one shared shortlist: the database's saved settings, ratings, notes, leagues, and votes remain in place when configuration files change. Use a separate database for a different family or catalog. A build-time configuration change does not delete or migrate existing decisions, and saved family settings take precedence over configured defaults.

The app hides leagues and tournaments whose frozen roster contains unknown candidate IDs, keeping those records intact in the database. They reappear when the matching catalog returns. Notes and exports cover the active catalog. Export each catalog before replacing it; a JSON export is not a backup of records belonging to a different catalog.

## Customize a preset

Copy `examples/starter/` to a private directory, edit its three JSON files, and select that directory:

```sh
cp -R examples/starter /path/to/my-name-config
node scripts/configure.mjs /path/to/my-name-config --check
node scripts/configure.mjs /path/to/my-name-config
```

`app.json` has this shape:

```json
{
  "title": "Name Garden",
  "description": "A shared baby name shortlist.",
  "locale": "en",
  "participants": {
    "first": "Participant 1",
    "second": "Participant 2"
  },
  "familyDefaults": {
    "fatherRu": "",
    "fatherLatin": "",
    "surnameRu": "",
    "surnameLatin": "",
    "patronymic": ""
  },
  "researchEnabled": false
}
```

Participant IDs `first` and `second` are stable database keys; customize their display labels. These profile labels attribute decisions and do not authenticate visitors. The app currently supports exactly two participants. Family fields belong to the specialized RU/BR/EN document-comparison example and can remain blank. `researchEnabled` controls whether the optional research tools are shown; the starter's research catalog is empty.

Configuration is bundled into client code and can appear in exports. Keep names and labels suitable for sharing. Store private preferences, notes, and family settings through the authenticated running app. Active `config/*.json` files are tracked in this repository; review them before committing or publishing changes.

## Candidate schema

Copy an existing starter record rather than constructing a candidate from scratch. Each candidate needs a unique stable ASCII `id` and a nonempty display `name`. IDs may contain letters, digits, underscores, dots, and hyphens, up to 80 characters. Keep IDs unchanged after people record ratings or comparisons.

The basic language fields `ru`, `br`, and `en` hold the primary, Brazilian Portuguese, and English name forms. `nicknames` contains strings keyed by the same language codes. Additional strings preserve the original research schema: `russian_name`, `br_spelling_candidate`, `possible_russian_rendering`, `spelling_status`, `english_use_and_cognate`, `russian_affectionate`, `brazilian_affectionate`, `english_affectionate`, `overall_fit`, `russian_comfort`, `brazilian_comfort`, `english_comfort`, `origin_meaning`, `culture_christian_links`, `notes_popularity`, and `source_id`. Use empty strings when a field has not been researched.

Every candidate includes:

```json
{
  "initialRatings": { "first": "neutral", "second": "neutral" },
  "references": [],
  "spellingComparisons": []
}
```

Reference records may contain `reference`, `url`, `scope_limits`, `compiled`, and `russian_form`. Source URLs must use HTTP or HTTPS. Do not include workbook provenance, private rating metadata, or `user_decision` fields; the validator rejects those fields. The active catalog supports 2–5000 candidates.

## Optional research

`research.json` contains four objects keyed by candidate ID: `passports`, `cultural`, `shortforms`, and `pronunciations`. It also contains four source arrays: `passportSources`, `culturalSources`, `shortformSources`, and `pronunciationSources`. Empty research uses `{}` for each catalog and `[]` for each source array, as in the starter example. Unknown candidate IDs and invalid source URLs are rejected.

The existing RU/BR/EN research record shapes are documented by the typed view models in `app/components/NameResearch.tsx`. Prefer copying and adapting a complete example record, keeping its evidence, limits, dates, and source IDs together. The linked source pages are external works; including a source link does not grant redistribution rights to its text or files. The example preserves editorial summaries and provenance links, without the downloaded documents.

All bundled data enters the app through `lib/catalog.ts`; API validation, browsing, filtering, research, and exports share the same active IDs. The selection script is optional: editing the three active configuration files directly is also supported. Validation runs when the catalog loads, so malformed configurations fail with a field-specific error.
