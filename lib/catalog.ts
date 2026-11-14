import app from '../config/app.json' with { type: 'json' };
import candidates from '../config/names.json' with { type: 'json' };
import research from '../config/research.json' with { type: 'json' };
import { validatePreset } from '../config/validate.mjs';
import type { Person, Rating } from './types';

export type FamilyDefaults = {
  fatherRu: string;
  fatherLatin: string;
  surnameRu: string;
  surnameLatin: string;
  patronymic: string;
};
export type AppConfig = {
  title: string;
  description: string;
  locale?: 'en' | 'ru';
  participants: Record<Person, string>;
  familyDefaults: FamilyDefaults;
  researchEnabled: boolean;
};
export type NameReference = {
  id?: string;
  reference: string;
  url: string;
  scope_limits?: string;
  compiled?: string;
  russian_form?: string;
};
export type Name = {
  id: string;
  name: string;
  ru: string;
  br: string;
  en: string;
  russian_name: string;
  br_spelling_candidate: string;
  possible_russian_rendering: string;
  spelling_status: string;
  english_use_and_cognate: string;
  russian_affectionate: string;
  brazilian_affectionate: string;
  english_affectionate: string;
  overall_fit: string;
  russian_comfort: string;
  brazilian_comfort: string;
  english_comfort: string;
  origin_meaning: string;
  culture_christian_links: string;
  notes_popularity: string;
  source_id: string;
  nicknames: Record<'ru' | 'br' | 'en', string>;
  initialRatings: Record<Person, Rating>;
  references: NameReference[];
  spellingComparisons: Record<string, string>[];
};
export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  scopeRu?: string;
  limitationsRu?: string;
  [key: string]: unknown;
};
export type ResearchCatalog = {
  passports: Record<string, Record<string, unknown>>;
  cultural: Record<string, Record<string, unknown>>;
  shortforms: Record<string, Record<string, unknown>>;
  pronunciations: Record<string, Record<string, unknown>>;
  passportSources: ResearchSource[];
  culturalSources: ResearchSource[];
  shortformSources: ResearchSource[];
  pronunciationSources: ResearchSource[];
};

// Fail at startup/build with a useful error instead of using partially valid data.
validatePreset({ app, names: candidates, research });
export const appConfig = app as AppConfig;
export const names = candidates as Name[];
export const participantLabels = appConfig.participants;
export const familyDefaults = appConfig.familyDefaults;
export const researchEnabled = appConfig.researchEnabled;
export const researchCatalog = research as ResearchCatalog;
export const { passports, cultural, shortforms, pronunciations,
  passportSources, culturalSources, shortformSources, pronunciationSources } = researchCatalog;
