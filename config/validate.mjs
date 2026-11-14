/** Validate a complete preset before it becomes the active, bundled catalog. */
const familyKeys = ['fatherRu', 'fatherLatin', 'surnameRu', 'surnameLatin', 'patronymic'];
const textFields = [
  'name', 'ru', 'br', 'en', 'russian_name', 'br_spelling_candidate',
  'possible_russian_rendering', 'spelling_status', 'english_use_and_cognate',
  'russian_affectionate', 'brazilian_affectionate', 'english_affectionate',
  'overall_fit', 'russian_comfort', 'brazilian_comfort', 'english_comfort',
  'origin_meaning', 'culture_christian_links', 'notes_popularity', 'source_id',
];
const catalogKeys = ['passports', 'cultural', 'shortforms', 'pronunciations'];
const sourceKeys = ['passportSources', 'culturalSources', 'shortformSources', 'pronunciationSources'];

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function string(value, label, { empty = true, max = 12000 } = {}) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) {
    throw new Error(`${label} must be ${empty ? 'a' : 'a nonempty'} string of at most ${max} characters.`);
  }
  return value;
}
function httpUrl(value, label) {
  string(value, label, { empty: false, max: 3000 });
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be an HTTP(S) URL.`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must be an HTTP(S) URL.`);
}
function list(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
function strings(value, label) {
  for (const [index, item] of list(value, label).entries()) string(item, `${label}[${index}]`);
}
function reading(value, label) {
  object(value, label);
  for (const key of ['written', 'readingRu', 'noteRu']) string(value[key], `${label}.${key}`);
  if (!['dictionary', 'linguistic-inference', 'unverified'].includes(value.evidence)) throw new Error(`${label}.evidence is unknown.`);
  strings(value.sourceIds, `${label}.sourceIds`);
}
function researchRow(key, row, label) {
  if (key === 'passports') {
    for (const field of ['brazilianCandidate', 'russianInternalTarget', 'russianForeignDefault']) string(row[field], `${label}.${field}`);
    if (typeof row.defaultLatinMatches !== 'boolean') throw new Error(`${label}.defaultLatinMatches must be a boolean.`);
    strings(row.sourceIds, `${label}.sourceIds`);
  }
  if (key === 'cultural') {
    for (const field of ['jewish', 'postSoviet']) {
      const context = object(row[field], `${label}.${field}`);
      string(context.level, `${label}.${field}.level`);
      string(context.noteRu, `${label}.${field}.noteRu`);
      strings(context.sourceIds, `${label}.${field}.sourceIds`);
      for (const [index, evidence] of list(context.evidence, `${label}.${field}.evidence`).entries()) {
        object(evidence, `${label}.${field}.evidence[${index}]`);
        for (const item of ['observedSpelling', 'scopeRu', 'matchRelation', 'sourceId']) string(evidence[item], `${label}.${field}.evidence[${index}].${item}`);
      }
    }
  }
  if (key === 'shortforms') {
    for (const [index, choice] of list(row.shared, `${label}.shared`).entries()) {
      const choiceLabel = `${label}.shared[${index}]`;
      object(choice, choiceLabel);
      for (const field of ['latin', 'ru', 'kind', 'noteRu']) string(choice[field], `${choiceLabel}.${field}`);
      object(choice.comfort, `${choiceLabel}.comfort`);
      for (const language of ['ru', 'br', 'en']) string(choice.comfort[language], `${choiceLabel}.comfort.${language}`);
      strings(choice.sourceIds, `${choiceLabel}.sourceIds`);
      if (choice.pronunciation) {
        object(choice.pronunciation, `${choiceLabel}.pronunciation`);
        for (const [language, value] of Object.entries(choice.pronunciation)) reading(value, `${choiceLabel}.pronunciation.${language}`);
      }
    }
    object(row.local, `${label}.local`);
    for (const language of ['ru', 'br', 'en']) strings(row.local[language], `${label}.local.${language}`);
    for (const [index, risk] of list(row.risks, `${label}.risks`).entries()) {
      object(risk, `${label}.risks[${index}]`);
      for (const field of ['language', 'severity', 'term', 'noteRu']) string(risk[field], `${label}.risks[${index}].${field}`);
    }
  }
  if (key === 'pronunciations') {
    if (!['researched', 'limited'].includes(row.reviewLevel)) throw new Error(`${label}.reviewLevel is unknown.`);
    string(row.summaryRu, `${label}.summaryRu`);
    string(row.checkedAt, `${label}.checkedAt`);
    object(row.full, `${label}.full`);
    for (const [language, value] of Object.entries(row.full)) reading(value, `${label}.full.${language}`);
  }
}

export function validatePreset(input) {
  object(input, 'preset');
  const app = object(input.app, 'app');
  string(app.title, 'app.title', { empty: false, max: 100 });
  string(app.description, 'app.description', { max: 300 });
  const participants = object(app.participants, 'app.participants');
  for (const id of ['first', 'second']) string(participants[id], `app.participants.${id}`, { empty: false, max: 60 });
  const family = object(app.familyDefaults, 'app.familyDefaults');
  for (const key of familyKeys) string(family[key], `app.familyDefaults.${key}`, { max: 120 });
  if (typeof app.researchEnabled !== 'boolean') throw new Error('app.researchEnabled must be a boolean.');
  if (app.locale !== undefined && !['en', 'ru'].includes(app.locale)) throw new Error('app.locale must be en or ru.');

  if (!Array.isArray(input.names) || input.names.length < 2 || input.names.length > 5000) {
    throw new Error('names must contain 2–5000 candidates.');
  }
  const ids = new Set();
  for (const [index, candidate] of input.names.entries()) {
    const label = `names[${index}]`;
    const name = object(candidate, label);
    if (typeof name.id !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(name.id)) throw new Error(`${label}.id must be a stable ASCII identifier.`);
    if (ids.has(name.id)) throw new Error(`Duplicate candidate ID: ${name.id}`);
    ids.add(name.id);
    for (const key of textFields) string(name[key], `${label}.${key}`, { empty: key !== 'name' });
    object(name.nicknames, `${label}.nicknames`);
    for (const language of ['ru', 'br', 'en']) string(name.nicknames[language], `${label}.nicknames.${language}`);
    object(name.initialRatings, `${label}.initialRatings`);
    for (const person of ['first', 'second']) {
      if (name.initialRatings[person] !== 'neutral') throw new Error(`${label}.initialRatings.${person} must be neutral; preferences belong in the database.`);
    }
    if ('provenance' in name || 'initialRatingMeta' in name || 'user_decision' in name) throw new Error(`${label} contains private import metadata.`);
    if (!Array.isArray(name.references) || !Array.isArray(name.spellingComparisons)) throw new Error(`${label} requires references and spellingComparisons arrays.`);
    for (const [referenceIndex, reference] of name.references.entries()) {
      object(reference, `${label}.references[${referenceIndex}]`);
      string(reference.reference, `${label}.references[${referenceIndex}].reference`);
      if (reference.url) httpUrl(reference.url, `${label}.references[${referenceIndex}].url`);
    }
  }
  const research = object(input.research, 'research');
  for (const key of catalogKeys) {
    const catalog = object(research[key], `research.${key}`);
    for (const [id, row] of Object.entries(catalog)) {
      if (!ids.has(id)) throw new Error(`research.${key} has unknown candidate ID: ${id}`);
      object(row, `research.${key}.${id}`);
      researchRow(key, row, `research.${key}.${id}`);
    }
  }
  const allSourceIds = new Set();
  for (const key of sourceKeys) {
    if (!Array.isArray(research[key])) throw new Error(`research.${key} must be an array.`);
    const sourceIds = new Set();
    for (const [index, source] of research[key].entries()) {
      object(source, `research.${key}[${index}]`);
      string(source.id, `research.${key}[${index}].id`, { empty: false, max: 100 });
      if (sourceIds.has(source.id)) throw new Error(`Duplicate source ID in ${key}: ${source.id}`);
      sourceIds.add(source.id);
      allSourceIds.add(source.id);
      string(source.title, `research.${key}[${index}].title`, { empty: false });
      httpUrl(source.url, `research.${key}[${index}].url`);
    }
  }
  function checkSourceLinks(value, label) {
    if (Array.isArray(value)) return value.forEach((child, index) => checkSourceLinks(child, `${label}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourceIds') {
        strings(child, `${label}.sourceIds`);
        for (const id of child) if (!allSourceIds.has(id)) throw new Error(`${label} references an unknown source ID: ${id}`);
      } else if (key === 'sourceId' && typeof child === 'string' && !allSourceIds.has(child)) {
        throw new Error(`${label} references an unknown source ID: ${child}`);
      } else checkSourceLinks(child, `${label}.${key}`);
    }
  }
  for (const key of catalogKeys) checkSourceLinks(research[key], `research.${key}`);
  return input;
}
