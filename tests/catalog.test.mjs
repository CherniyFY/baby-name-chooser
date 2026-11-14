import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePreset } from '../config/validate.mjs';
import { configure, readPreset } from '../scripts/configure.mjs';
import { appConfig, names, researchCatalog } from '../lib/catalog.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const preset = name => readPreset(path.join(projectRoot, 'examples', name));

test('the active catalog follows the selected valid configuration', async () => {
  validatePreset({ app: appConfig, names, research: researchCatalog });
  const active = await readPreset(path.join(projectRoot, 'config'));
  assert.deepEqual(appConfig, active.app);
  assert.deepEqual(names, active.names);
  assert.deepEqual(researchCatalog, active.research);
});

test('both shipped examples are clean neutral configurations', async () => {
  for (const name of ['starter', 'ru-br-en']) {
    const data = await preset(name);
    assert.equal(data.names.length, name === 'starter' ? 8 : 248);
    assert.ok(Object.values(data.app.familyDefaults).every(value => value === ''));
    for (const candidate of data.names) {
      assert.deepEqual(candidate.initialRatings, { first: 'neutral', second: 'neutral' });
      assert.equal('provenance' in candidate, false);
      assert.equal('initialRatingMeta' in candidate, false);
      assert.equal('user_decision' in candidate, false);
    }
    assert.doesNotMatch(JSON.stringify(data), /father also|father shares|appgprj_|libfile_|chatgpt\.com\/library/i);
  }
});

test('the RU/BR/EN example preserves research coverage and source provenance', async () => {
  const { names, research } = await preset('ru-br-en');
  for (const key of ['passports', 'cultural', 'shortforms']) {
    assert.equal(Object.keys(research[key]).length, names.length);
  }
  assert.equal(Object.keys(research.pronunciations).length, 21);
  for (const key of ['passportSources', 'culturalSources', 'shortformSources', 'pronunciationSources']) {
    assert.ok(research[key].length > 0);
    assert.ok(research[key].every(source => source.id && /^https?:\/\//.test(source.url)));
  }
});

test('participants, title, candidate fields, and family defaults are configurable', async () => {
  const data = structuredClone(await preset('starter'));
  data.app.title = 'Our shortlist';
  data.app.participants = { first: 'Alex', second: 'Morgan' };
  data.app.familyDefaults.surnameLatin = 'Example';
  data.names[0].name = 'A new candidate';
  assert.equal(validatePreset(data), data);
});

test('invalid or private imported configuration is rejected before activation', async () => {
  const original = await preset('starter');
  const invalidCases = [
    data => { data.names[1].id = data.names[0].id; },
    data => { data.names[0].initialRatings.first = 'dismissed'; },
    data => { data.names[0].provenance = { row: 7 }; },
    data => { data.names[0].initialRatingMeta = {}; },
    data => { data.research.passports['unknown-id'] = {}; },
    data => { data.research.shortforms[data.names[0].id] = { shared: 'not-an-array' }; },
    data => { data.app.participants.second = ''; },
    data => { data.research.passportSources.push({ id: 'bad', title: 'bad', url: 'javascript:alert(1)' }); },
  ];
  for (const change of invalidCases) {
    const data = structuredClone(original);
    change(data);
    assert.throws(() => validatePreset(data));
  }
  const unresolvedSource = structuredClone(await preset('ru-br-en'));
  unresolvedSource.research.passports.N001.sourceIds.push('MISSING-SOURCE');
  assert.throws(() => validatePreset(unresolvedSource), /unknown source ID/);
});

test('configuration selection validates complete custom presets before writing', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'name-garden-config-'));
  const destination = path.join(temporary, 'active');
  try {
    await configure('starter', { destination });
    const before = await readFile(path.join(destination, 'names.json'), 'utf8');
    const custom = await preset('ru-br-en');
    custom.names[1].id = custom.names[0].id;
    const source = path.join(temporary, 'invalid');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(source);
    for (const file of ['app', 'names', 'research']) await writeFile(path.join(source, `${file}.json`), JSON.stringify(custom[file]));
    await assert.rejects(configure(source, { destination }), /Duplicate candidate ID/);
    assert.equal(await readFile(path.join(destination, 'names.json'), 'utf8'), before);
    const result = await configure('ru-br-en', { destination });
    assert.equal(result.names, 248);
    assert.equal((await readPreset(destination)).names.length, 248);
    await configure('starter', { destination, check: true });
    assert.equal((await readPreset(destination)).names.length, 248);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
