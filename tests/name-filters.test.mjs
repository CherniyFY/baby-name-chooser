import test from 'node:test';
import assert from 'node:assert/strict';
import { names, appConfig } from '../lib/catalog.ts';
import { defaultNameFilters, normalizeNameFilters, filterNameIds, matchesName, nameRatings, activeNameFilterChips } from '../lib/name-filters.ts';

const [a,b,c] = names;
const context = (overrides={}) => ({person:'first',ratings:{},notes:{},...overrides});

test('choices are OR within one participant and AND between participants', () => {
  const ctx=context({ratings:{[a.id]:{first:'love',second:'neutral'},[b.id]:{first:'love',second:'maybe'},[c.id]:{first:'like',second:'maybe'}}});
  const filters=defaultNameFilters({first:['love','like'],second:['maybe']});
  assert.deepEqual(filterNameIds([a.id,b.id,c.id],filters,ctx),[b.id,c.id]);
  assert.equal(matchesName(b.id,defaultNameFilters({...filters,family:'mutual'}),ctx),false);
  assert.deepEqual(activeNameFilterChips(filters).map(chip=>chip.label),[`${appConfig.participants.first}: Love`,`${appConfig.participants.first}: Like`,`${appConfig.participants.second}: Maybe`]);
});

test('starter and examples begin neutral; explicit ratings can be reversed', () => {
  assert.deepEqual(nameRatings(a.id,context()),{first:'neutral',second:'neutral'});
  const dismissed=context({ratings:{[a.id]:{first:'neutral',second:'dismissed'}}});
  assert.equal(matchesName(a.id,defaultNameFilters({family:'active'}),dismissed),false);
  const restored=context({ratings:{[a.id]:{first:'neutral',second:'neutral'}}});
  assert.equal(matchesName(a.id,defaultNameFilters({family:'active'}),restored),true);
});

test('shared notes support AND words, exact phrases, exclusions and case folding', () => {
  const ctx=context({notes:{[a.id]:'Warm choice for our home'}});
  assert.equal(matchesName(a.id,defaultNameFilters({query:'WARM "our home" -cold'}),ctx),true);
  assert.equal(matchesName(a.id,defaultNameFilters({query:'warm "our home" -home'}),ctx),false);
  assert.equal(matchesName(b.id,defaultNameFilters({query:'warm "our home"'}),ctx),false);
});

test('a fixed set and contextual membership combine without changing selection', () => {
  const selectedIds=[a.id,b.id],leagueIds=[b.id,c.id],before=[...selectedIds];
  const filters=defaultNameFilters({selected:'yes',league:'out'});
  assert.deepEqual(filterNameIds([a.id,b.id,c.id,a.id],filters,context({selectedIds,leagueIds})),[a.id]);
  assert.deepEqual(selectedIds,before);
  assert.equal(matchesName(c.id,filters,context()),true);
  const fixed=defaultNameFilters({nameIds:[b.id,a.id]});
  assert.deepEqual(filterNameIds([a.id,b.id,c.id],fixed,context()),[a.id,b.id]);
});

test('saved filters whitelist values and normalize length bounds', () => {
  const filters=normalizeNameFilters({family:'delete-all',first:['love','love','unknown'],second:'veto',query:'a'.repeat(900),minLength:99,maxLength:2,homeRecommendation:['best','bogus'],comfortRu:['Difficult','Historical / formal'],__malicious:'ignored'});
  assert.equal(filters.family,'any');
  assert.deepEqual(filters.first,['love']);
  assert.deepEqual(filters.second,[]);
  assert.equal(filters.query.length,500);
  assert.equal(filters.minLength,2);
  assert.equal(filters.maxLength,80);
  assert.deepEqual(filters.homeRecommendation,['best']);
  assert.deepEqual(filters.comfortRu,['Historical / formal']);
  assert.equal('__malicious' in filters,false);
  assert.deepEqual(normalizeNameFilters(null),defaultNameFilters());
});

test('independent filter factories never share arrays', () => {
  const first=defaultNameFilters(),second=defaultNameFilters();
  first.first.push('love');
  first.nameIds.push(a.id);
  assert.deepEqual(second.first,[]);
  assert.deepEqual(second.nameIds,[]);
});

test('unknown IDs are removed from portable fixed sets and results', () => {
  const filters=defaultNameFilters({nameIds:[a.id,'missing',a.id]});
  assert.deepEqual(filters.nameIds,[a.id]);
  assert.deepEqual(filterNameIds(['missing',a.id,a.id],filters,context()),[a.id]);
});

test('length counts unicode characters and ignores spaces and hyphens', () => {
  const length=Array.from(a.name.replace(/[\s-]/g,'')).length;
  assert.equal(matchesName(a.id,defaultNameFilters({minLength:length,maxLength:length}),context()),true);
  assert.equal(matchesName(a.id,defaultNameFilters({minLength:length+1}),context()),false);
});

test('notes, disagreement and positive support are independent facets', () => {
  const ctx=context({ratings:{[a.id]:{first:'love',second:'like'},[b.id]:{first:'love',second:'veto'}},notes:{[a.id]:'Discuss together'}});
  assert.equal(matchesName(a.id,defaultNameFilters({family:'mutual',notes:'yes'}),ctx),true);
  assert.equal(matchesName(a.id,defaultNameFilters({family:'disagreement',notes:'yes'}),ctx),true);
  assert.equal(matchesName(b.id,defaultNameFilters({family:'mutual'}),ctx),false);
  assert.equal(matchesName(a.id,defaultNameFilters({notes:'no'}),ctx),false);
});
