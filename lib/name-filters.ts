import { names as imported, passports, cultural, shortforms, pronunciations, appConfig } from './catalog.ts';
import type { Person, Rating, SharedState } from './types';

export type FamilyFilter = 'any'|'active'|'mutual'|'favorites'|'later'|'veto'|'unreviewed'|'either-unreviewed'|'reviewed'|'disagreement';
export type FilterLanguage = 'ru'|'br'|'en';
export type NameFilters = {
  query:string; nameIds:string[]; family:FamilyFilter; first:Rating[]; second:Rating[];
  passport:'any'|'match'|'mismatch'; jewish:string[]; postSoviet:string[];
  armenian:'any'|'yes'|'no'; kazakhstan:'any'|'yes'|'no';
  risk:'any'|'flagged'|'none'|'high'|'medium-up'; riskLanguages:string[];
  shortforms:'any'|'reviewed'|'best'|'documented'|'family'|'full-only';
  homeRecommendation:string[]; homeKinds:string[];
  pronunciation:'any'|'reviewed'|'unreviewed'; comfort:FilterLanguage[];
  comfortRu:string[]; comfortBr:string[]; comfortEn:string[]; fit:string[];
  notes:'any'|'yes'|'no'; selected:'any'|'yes'|'no'; league:'any'|'in'|'out';
  minLength:number|null; maxLength:number|null;
};
export type NameFilterContext = {
  person:Person; ratings:SharedState['ratings']; notes:SharedState['notes'];
  selectedIds?:string[]; leagueIds?:string[];
};
export const ratingLabels:Record<Rating,string> = {love:'Love',like:'Like',maybe:'Maybe',dismissed:'Set aside',veto:'No',neutral:'Unrated'};
export const ratingValues:Rating[] = ['love','like','maybe','dismissed','veto','neutral'];
export const familyOptions:{value:FamilyFilter;label:string}[] = [
  {value:'any',label:'Any combination'}, {value:'active',label:'Exclude set-aside and No ratings'},
  {value:'mutual',label:'Both like it'}, {value:'favorites',label:'My favorites'},
  {value:'later',label:'Either set it aside'}, {value:'veto',label:'Either marked No'},
  {value:'unreviewed',label:'Both unrated'}, {value:'either-unreviewed',label:'Either still unrated'},
  {value:'reviewed',label:'Both rated'}, {value:'disagreement',label:'Ratings differ'},
];
export const evidenceOptions = [
  {value:'documented-current',label:'Recent evidence'},
  {value:'established-association',label:'Association or older evidence'},
  {value:'not-established',label:'Not established by selected sources'},
];
export const fitOptions = [
  {value:'Shortlist',label:'Previously shortlisted'}, {value:'Good',label:'Good in earlier review'},
  {value:'Particular taste',label:'A particular taste'}, {value:'Weak for this brief',label:'Weak for the original brief'}, {value:'Avoid',label:'Earlier recommendation to avoid'},
];
export const comfortOptions = [
  {value:'Natural / familiar',label:'Natural or familiar'},
  {value:'Established international',label:'Established internationally'},
  {value:'Workable foreign',label:'Workable foreign name'},
  {value:'Historical / formal',label:'Historical or formal'},
  {value:'Difficult',label:'Difficult in earlier review'},
];
export const homeRecommendationOptions=[{value:'best',label:'Try first'},{value:'usable',label:'With reservations'},{value:'local-only',label:'Local form only'},{value:'avoid',label:'Not a first choice'},{value:'ungraded',label:'No comparative review'}];
export const homeKindOptions=[{value:'documented',label:'Dictionary evidence'},{value:'family-proposal',label:'Household proposal'},{value:'full-name',label:'Full name'}];
const languages:FilterLanguage[] = ['ru','br','en'];
const names = new Map(imported.map(n=>[n.id,n]));
type ShortRow = {shared:{latin:string;ru:string;kind:string;recommendation?:string;pronunciation?:unknown;noteRu?:string}[];risks:{language:string;severity:string;term:string;noteRu:string}[]};
type CultureRow = {jewish:{level:string};postSoviet:{level:string;evidence:{referenceYear:number|null;matchRelation:string;count:number|null}[]}};
const shorts = shortforms as unknown as Record<string,ShortRow>;
const cultures = cultural as unknown as Record<string,CultureRow>;
const passportData = passports as Record<string,{defaultLatinMatches:boolean;russianForeignDefault:string}>;
const pronunciationData = pronunciations as Record<string,{reviewLevel:string}>;
const fold = (s:string) => s.normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё','е');
const searchText = new Map(imported.map(n=>[n.id,fold([
  n.name,n.br,n.en,n.origin_meaning,n.culture_christian_links,n.notes_popularity,
  ...Object.values(n.nicknames),passportData[n.id]?.russianForeignDefault,
  ...(shorts[n.id]?.shared.flatMap(x=>[x.latin,x.ru,x.noteRu||''])||[]),
].join(' '))]));

export function defaultNameFilters(overrides:Partial<NameFilters>={}):NameFilters {
  return normalizeNameFilters({query:'',nameIds:[],family:'any',first:[],second:[],passport:'any',jewish:[],postSoviet:[],armenian:'any',kazakhstan:'any',risk:'any',riskLanguages:[],shortforms:'any',homeRecommendation:[],homeKinds:[],pronunciation:'any',comfort:[],comfortRu:[],comfortBr:[],comfortEn:[],fit:[],notes:'any',selected:'any',league:'any',minLength:null,maxLength:null,...overrides});
}
function one<T extends string>(input:unknown,allowed:readonly T[],fallback:T):T {return typeof input==='string'&&allowed.includes(input as T)?input as T:fallback;}
function many<T extends string>(input:unknown,allowed:readonly T[]):T[] {return Array.isArray(input)?[...new Set(input.filter((v):v is T=>typeof v==='string'&&allowed.includes(v as T)))]:[];}
function length(input:unknown):number|null {
  if(input===null||input===undefined||input===''||typeof input==='boolean')return null;
  if(typeof input!=='number'&&typeof input!=='string')return null;
  const n=Number(input);return Number.isFinite(n)?Math.max(1,Math.min(80,Math.floor(n))):null;
}
/** Whitelist persisted/URL data; never spread arbitrary saved keys into UI state. */
export function normalizeNameFilters(input:unknown):NameFilters {
  const v=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
  let minLength=length(v.minLength),maxLength=length(v.maxLength);
  if(minLength!==null&&maxLength!==null&&minLength>maxLength)[minLength,maxLength]=[maxLength,minLength];
  return {
    query:typeof v.query==='string'?v.query.slice(0,500):'',nameIds:many(v.nameIds,[...names.keys()]),family:one(v.family,familyOptions.map(x=>x.value),'any'),
    first:many(v.first,ratingValues),second:many(v.second,ratingValues),passport:one(v.passport,['any','match','mismatch'],'any'),
    jewish:many(v.jewish,evidenceOptions.map(x=>x.value)),postSoviet:many(v.postSoviet,evidenceOptions.map(x=>x.value)),
    armenian:one(v.armenian,['any','yes','no'],'any'),kazakhstan:one(v.kazakhstan,['any','yes','no'],'any'),
    risk:one(v.risk,['any','flagged','none','high','medium-up'],'any'),riskLanguages:many(v.riskLanguages,['ru','br','en','cross']),
    shortforms:one(v.shortforms,['any','reviewed','best','documented','family','full-only'],'any'),
    homeRecommendation:many(v.homeRecommendation,homeRecommendationOptions.map(x=>x.value)),homeKinds:many(v.homeKinds,homeKindOptions.map(x=>x.value)),
    pronunciation:one(v.pronunciation,['any','reviewed','unreviewed'],'any'),comfort:many(v.comfort,languages),
    comfortRu:many(v.comfortRu,comfortOptions.filter(x=>x.value!=='Difficult').map(x=>x.value)),comfortBr:many(v.comfortBr,comfortOptions.filter(x=>x.value!=='Historical / formal').map(x=>x.value)),comfortEn:many(v.comfortEn,comfortOptions.filter(x=>x.value!=='Historical / formal').map(x=>x.value)),fit:many(v.fit,fitOptions.map(x=>x.value)),
    notes:one(v.notes,['any','yes','no'],'any'),selected:one(v.selected,['any','yes','no'],'any'),league:one(v.league,['any','in','out'],'any'),minLength,maxLength,
  };
}
export function nameRatings(id:string,context:NameFilterContext):Record<Person,Rating> {
  const initial=names.get(id)?.initialRatings;
  return {first:context.ratings[id]?.first??(initial?.first as Rating|undefined)??'neutral',second:context.ratings[id]?.second??(initial?.second as Rating|undefined)??'neutral'};
}
const positive=(r:Rating)=>r==='love'||r==='like';
function familyMatches(family:FamilyFilter,r:Record<Person,Rating>,person:Person) {
  const values=[r.first,r.second];
  switch(family){
    case 'active':return !values.some(v=>v==='dismissed'||v==='veto');
    case 'mutual':return values.every(positive);
    case 'favorites':return r[person]==='love';
    case 'later':return values.includes('dismissed');
    case 'veto':return values.includes('veto');
    case 'unreviewed':return values.every(v=>v==='neutral');
    case 'either-unreviewed':return values.includes('neutral');
    case 'reviewed':return values.every(v=>v!=='neutral');
    case 'disagreement':return r.first!==r.second;
    default:return true;
  }
}
function hasQuery(text:string,query:string) {
  const tokens=fold(query).match(/-?"[^"]+"|\S+/g)||[];
  return tokens.every(token=>{const excluded=token.startsWith('-')&&token.length>1;const needle=(excluded?token.slice(1):token).replace(/^"|"$/g,'');return excluded?!text.includes(needle):text.includes(needle);});
}
function matchesNormalized(id:string,f:NameFilters,context:NameFilterContext):boolean {
  const n=names.get(id);if(!n)return false;
  if(f.nameIds.length&&!f.nameIds.includes(id))return false;
  const r=nameRatings(id,context),s=shorts[id],c=cultures[id];
  if(!familyMatches(f.family,r,context.person))return false;
  if(f.first.length&&!f.first.includes(r.first)||f.second.length&&!f.second.includes(r.second))return false;
  if(f.query&&!hasQuery((searchText.get(id)||'')+' '+fold(context.notes[id]||''),f.query))return false;
  if(f.passport!=='any'&&passportData[id]?.defaultLatinMatches!==(f.passport==='match'))return false;
  if(f.jewish.length&&!f.jewish.includes(c?.jewish.level)||f.postSoviet.length&&!f.postSoviet.includes(c?.postSoviet.level))return false;
  const armenian=c?.postSoviet.level==='documented-current';
  const large=c?.postSoviet.evidence.some(e=>e.referenceYear===2021&&e.matchRelation==='exact'&&(e.count??0)>=1000)||false;
  if(f.armenian!=='any'&&armenian!==(f.armenian==='yes')||f.kazakhstan!=='any'&&large!==(f.kazakhstan==='yes'))return false;
  // Language and severity refer to the SAME recorded association, not two unrelated entries.
  const risks=(s?.risks||[]).filter(r=>!f.riskLanguages.length||f.riskLanguages.includes(r.language));
  if(f.risk==='none'&&risks.length>0)return false;
  if((f.risk==='flagged'||f.risk==='any'&&f.riskLanguages.length>0)&&!risks.length)return false;
  if(f.risk==='high'&&!risks.some(r=>r.severity==='high'))return false;
  if(f.risk==='medium-up'&&!risks.some(r=>r.severity==='medium'||r.severity==='high'))return false;
  const shared=s?.shared||[];
  const candidates=shared.filter(x=>(!f.homeRecommendation.length||f.homeRecommendation.includes(x.recommendation||'ungraded'))&&(!f.homeKinds.length||f.homeKinds.includes(x.kind)));
  if((f.homeRecommendation.length||f.homeKinds.length)&&!candidates.length)return false;
  if(f.shortforms==='reviewed'&&!candidates.some(x=>x.pronunciation))return false;
  if(f.shortforms==='best'&&!candidates.some(x=>x.recommendation==='best'))return false;
  if(f.shortforms==='documented'&&!candidates.some(x=>x.kind==='documented'))return false;
  if(f.shortforms==='family'&&!candidates.some(x=>x.kind==='family-proposal'))return false;
  if(f.shortforms==='full-only'&&(!shared.length||!shared.every(x=>x.kind==='full-name')))return false;
  const reviewed=pronunciationData[id]?.reviewLevel==='researched';
  if(f.pronunciation!=='any'&&reviewed!==(f.pronunciation==='reviewed'))return false;
  for(const language of f.comfort){const value=language==='ru'?n.russian_comfort:language==='br'?n.brazilian_comfort:n.english_comfort;if(!/natural/i.test(value))return false;}
  if(f.comfortRu.length&&!f.comfortRu.includes(n.russian_comfort)||f.comfortBr.length&&!f.comfortBr.includes(n.brazilian_comfort)||f.comfortEn.length&&!f.comfortEn.includes(n.english_comfort))return false;
  if(f.fit.length&&!f.fit.includes(n.overall_fit))return false;
  if(f.notes!=='any'&&!!context.notes[id]?.trim()!==(f.notes==='yes'))return false;
  // Membership is contextual: portable views ignore a facet unavailable on this surface.
  if(context.selectedIds!==undefined&&f.selected!=='any'&&context.selectedIds.includes(id)!==(f.selected==='yes'))return false;
  if(context.leagueIds!==undefined&&f.league!=='any'&&context.leagueIds.includes(id)!==(f.league==='in'))return false;
  const nameLength=Array.from(n.name.replace(/[\s-]/g,'')).length;
  return (f.minLength===null||nameLength>=f.minLength)&&(f.maxLength===null||nameLength<=f.maxLength);
}
export function matchesName(id:string,filters:NameFilters,context:NameFilterContext):boolean {return matchesNormalized(id,normalizeNameFilters(filters),context);}
export function filterNameIds(ids:readonly string[],filters:NameFilters,context:NameFilterContext):string[] {
  const f=normalizeNameFilters(filters);return [...new Set(ids)].filter(id=>matchesNormalized(id,f,context));
}

export type NameFilterChip={key:keyof NameFilters;value?:string;label:string};
const languageLabels:Record<string,string>={ru:'RU',br:'BR',en:'EN',cross:'Across languages'};
const valueLabels:Partial<Record<keyof NameFilters,Record<string,string>>>={
  family:Object.fromEntries(familyOptions.map(x=>[x.value,x.label])),passport:{match:'Latin spelling matches*',mismatch:'Latin spelling differs'},
  armenian:{yes:'Armenia 2025 evidence',no:'No Armenia 2025 evidence'},kazakhstan:{yes:'1000+ in a KZ 2021 group',no:'No 1000+ KZ 2021 observation'},
  risk:{flagged:'Recorded association',none:'No association recorded',high:'Notable association', 'medium-up':'Medium or high significance association'},
  shortforms:{reviewed:'Short-form pronunciation reviewed',best:'A try-first short form',documented:'Dictionary-backed short form',family:'Household proposal','full-only':'Full name only'},
  pronunciation:{reviewed:'Full-name pronunciation reviewed',unreviewed:'Full-name pronunciation unreviewed'},notes:{yes:'Has a note',no:'No note'},selected:{yes:'Selected',no:'Not selected'},league:{in:'In current league',out:'Outside current league'},
};
export function activeNameFilterChips(filters:NameFilters):NameFilterChip[] {
  const f=normalizeNameFilters(filters),chips:NameFilterChip[]=[];
  for(const key of Object.keys(f) as (keyof NameFilters)[]){const value=f[key];if(value===null||value===''||value==='any')continue;
    if(key==='nameIds'){if(f.nameIds.length)chips.push({key,label:`Fixed set: ${f.nameIds.length} names`});continue;}
    if(Array.isArray(value)){for(const item of value){let label=item;if(key==='first'||key==='second')label=appConfig.participants[key]+': '+ratingLabels[item as Rating];else if(key==='jewish'||key==='postSoviet')label=(key==='jewish'?'Jewish context: ':'Post-Soviet context: ')+(evidenceOptions.find(x=>x.value===item)?.label||item);else if(key==='fit')label=fitOptions.find(x=>x.value===item)?.label||item;else if(key==='comfort')label='Earlier familiarity: '+languageLabels[item];else if(key==='comfortRu'||key==='comfortBr'||key==='comfortEn')label=(key==='comfortRu'?'RU: ':key==='comfortBr'?'BR: ':'EN: ')+(comfortOptions.find(x=>x.value===item)?.label||item);else if(key==='homeKinds')label='Short-form evidence: '+(homeKindOptions.find(x=>x.value===item)?.label||item);else if(key==='homeRecommendation')label='Short form: '+(homeRecommendationOptions.find(x=>x.value===item)?.label||item);else if(key==='riskLanguages')label='Associations: '+languageLabels[item];chips.push({key,value:item,label});}}
    else chips.push({key,label:key==='query'?`Search: ${value}`:key==='minLength'?`At least ${value} letters`:key==='maxLength'?`At most ${value} letters`:valueLabels[key]?.[String(value)]||String(value)});
  }return chips;
}
export function countNameFilters(filters:NameFilters):number {return activeNameFilterChips(filters).length;}
