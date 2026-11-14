"use client";

import { useId, useMemo } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { names as imported, appConfig } from "../../lib/catalog";
import {
  activeNameFilterChips, comfortOptions, defaultNameFilters, evidenceOptions,
  familyOptions, filterNameIds, fitOptions, homeKindOptions,
  homeRecommendationOptions, normalizeNameFilters, ratingLabels, ratingValues,
  type NameFilterContext, type NameFilters,
} from "../../lib/name-filters";
import "./NameFilters.css";

export type NameFilterPanelProps = {
  value: NameFilters;
  onChange: (value: NameFilters) => void;
  context: NameFilterContext;
  ids?: readonly string[];
  title?: string;
  hideFacets?: (keyof NameFilters)[];
  compact?: boolean;
};
type Options = { value: string; label: string }[];
const allIds = imported.map(n => n.id);
const namesById = new Map(imported.map(n => [n.id, n.name]));
const languageOptions = [
  { value: "ru", label: "Russian" },
  { value: "br", label: "Brazilian Portuguese" },
  { value: "en", label: "English" },
];
const researchFacets = new Set<keyof NameFilters>([
  "shortforms", "homeRecommendation", "homeKinds", "pronunciation", "comfort",
  "comfortRu", "comfortBr", "comfortEn", "fit", "passport", "risk",
  "riskLanguages", "jewish", "postSoviet", "armenian", "kazakhstan",
]);

/** Choices within one group use OR; different groups use AND. */
export function NameFilterPanel({
  value, onChange, context, ids = allIds, title = "Find your shortlist",
  hideFacets = [], compact = false,
}: NameFilterPanelProps) {
  const uid = useId();
  const f = useMemo(() => normalizeNameFilters(value), [value]);
  const chips = useMemo(() => activeNameFilterChips(f), [f]);
  const selectedSnapshot = useMemo(
    () => normalizeNameFilters({ nameIds: context.selectedIds }).nameIds,
    [context.selectedIds],
  );
  const visible = (key: keyof NameFilters) =>
    !hideFacets.includes(key) &&
    (appConfig.researchEnabled || !researchFacets.has(key)) &&
    (key !== "selected" || context.selectedIds !== undefined) &&
    (key !== "league" || context.leagueIds !== undefined);
  const change = (key: keyof NameFilters, next: unknown) =>
    onChange(normalizeNameFilters({ ...f, [key]: next }));
  const countCache = new Map<string, number>();
  const count = (key: keyof NameFilters, next: unknown) => {
    const cacheKey = key + ":" + JSON.stringify(next);
    const cached = countCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const result = filterNameIds(ids, normalizeNameFilters({ ...f, [key]: next }), context).length;
    countCache.set(cacheKey, result);
    return result;
  };
  const total = filterNameIds(ids, f, context).length;
  const arrayField = (key: keyof NameFilters, options: Options, label: string) => {
    if (!visible(key)) return null;
    const selected = f[key] as string[];
    return <fieldset className="nf-fieldset"><legend>{label}</legend><div className="nf-checks">
      {options.map(o => <label key={o.value}>
        <input type="checkbox" checked={selected.includes(o.value)} onChange={() => change(key, selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])}/>
        <span>{o.label}</span><small aria-label={`${count(key, [o.value])} names matching this condition`}>{count(key, [o.value])}</small>
      </label>)}
    </div></fieldset>;
  };
  const selectField = (key: keyof NameFilters, options: Options, label: string) => visible(key) ?
    <label className="nf-select"><span>{label}</span><select value={String(f[key])} onChange={e => change(key, e.target.value)} aria-label={label}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label} · {count(key, o.value)}</option>)}
    </select></label> : null;
  const has = (keys: (keyof NameFilters)[]) => keys.some(visible);
  const removeChip = (key: keyof NameFilters, item?: string) => change(key, item ? (f[key] as string[]).filter(v => v !== item) : defaultNameFilters()[key]);
  const presets = [
    { label: "Liked by both", value: defaultNameFilters({ family: "mutual" }) },
    { label: "Still to rate", value: defaultNameFilters({ family: "either-unreviewed" }) },
    { label: "Different ratings", value: defaultNameFilters({ family: "disagreement" }) },
    ...(appConfig.researchEnabled ? [{ label: "Latin spelling + nicknames", value: defaultNameFilters({ family: "active", passport: "match", shortforms: "reviewed" }) }] : []),
  ];
  return <section className={`name-filter-panel${compact ? " nf-compact" : ""}`} aria-label={title}>
    <div className="nf-heading"><div><p className="eyebrow">COMBINE YOUR OWN CRITERIA</p><h3>{title}</h3></div><p className="nf-total" aria-live="polite"><strong>{total}</strong> of {ids.length}</p></div>
    {visible("query") && <label className="nf-search"><Search size={18}/><input type="search" value={f.query} maxLength={500} onChange={e => change("query", e.target.value)} aria-label={`Search · ${title}`} placeholder="Name, nickname, meaning, or note…"/>{f.query && <button type="button" aria-label="Clear search text" onClick={() => change("query", "")}><X size={16}/></button>}</label>}
    {!compact && <div className="nf-presets" aria-label="Quick filter presets">{presets.map(p => <button type="button" key={p.label} onClick={() => onChange(p.value)}>{p.label}</button>)}<span>A preset replaces all criteria.</span></div>}
    {chips.length > 0 && <div className="nf-active" aria-label="Active filters">{chips.map(c => <button type="button" key={c.key + ":" + (c.value || "")} onClick={() => removeChip(c.key, c.value)} aria-label={`Remove filter: ${c.label}`} title="Remove this condition"><span>{c.label}</span><X size={13}/></button>)}<button type="button" className="nf-reset" onClick={() => onChange(defaultNameFilters())}>Reset all</button></div>}
    {visible("nameIds") && (selectedSnapshot.length > 0 || f.nameIds.length > 0) && <div className="nf-fixed-set">
      {selectedSnapshot.length > 0 && <button type="button" className="secondary" onClick={() => onChange(normalizeNameFilters({ ...f, nameIds: selectedSnapshot, selected: "any" }))}>Freeze selected names ({selectedSnapshot.length})</button>}
      {f.nameIds.length > 0 && <details><summary>Names in the fixed set ({f.nameIds.length}) <ChevronDown size={14}/></summary><p>{f.nameIds.map(id => namesById.get(id)).join(" · ")}</p></details>}
      <p className="nf-help">A fixed set is included in a saved view. Ordinary checkboxes depend on the current device selection. Freezing replaces the checkbox condition and keeps your other filters.</p>
    </div>}
    <details className="nf-options"><summary><SlidersHorizontal size={17}/><span>All criteria{chips.length ? ` · ${chips.length}` : ""}</span><ChevronDown size={16}/></summary>
      <p className="nf-help">Different groups use AND; choices within a group use OR, except where “all selected languages” is stated. Counts include your other conditions. Filters change visible rows while preserving ratings and existing game rosters.</p>
      {visible("query") && <p className="nf-help">Search several words, a "quoted phrase", or exclude a word: <code>-word</code>.</p>}
      <div className="nf-groups">
        {has(["family", "first", "second"]) && <details className="nf-group" open><summary>Participant ratings <ChevronDown size={16}/></summary><div className="nf-group-content">
          {selectField("family", familyOptions, "Rating combination")}
          {arrayField("first", ratingValues.map(value => ({ value, label: ratingLabels[value] })), `${appConfig.participants.first} · exact ratings`)}
          {arrayField("second", ratingValues.map(value => ({ value, label: ratingLabels[value] })), `${appConfig.participants.second} · exact ratings`)}
          <p className="nf-help">“Unrated” includes initial neutral names and ratings you explicitly reset. “Different ratings” includes any mismatch, such as Like / Love.</p>
        </div></details>}
        {has(["shortforms", "homeRecommendation", "homeKinds", "pronunciation", "comfort", "comfortRu", "comfortBr", "comfortEn", "fit"]) && <details className="nf-group"><summary>Nicknames and pronunciation <ChevronDown size={16}/></summary><div className="nf-group-content">
          {selectField("shortforms", [{ value: "any", label: "Any nickname coverage" }, { value: "reviewed", label: "Nickname pronunciation reviewed" }, { value: "best", label: "Has a recommended first option" }, { value: "documented", label: "Has a dictionary-attested nickname" }, { value: "family", label: "Has a proposed household form" }, { value: "full-only", label: "Only the full name is proposed" }], "Household forms")}
          {selectField("pronunciation", [{ value: "any", label: "Any review depth" }, { value: "reviewed", label: "Full name reviewed in three languages" }, { value: "unreviewed", label: "No detailed review yet" }], "Full-name pronunciation")}
          {arrayField("homeRecommendation", homeRecommendationOptions, "Recommendation for a specific nickname")}
          {arrayField("homeKinds", homeKindOptions, "Evidence type for the same nickname")}
          {arrayField("comfort", languageOptions, "Familiar in all selected languages · original assessment")}
          {arrayField("comfortRu", comfortOptions.filter(x => x.value !== "Difficult"), "Russian · exact original assessment")}
          {arrayField("comfortBr", comfortOptions.filter(x => x.value !== "Historical / formal"), "Brazil · exact original assessment")}
          {arrayField("comfortEn", comfortOptions.filter(x => x.value !== "Historical / formal"), "English · exact original assessment")}
          {arrayField("fit", fitOptions, "Original research assessment")}
          <p className="nf-help">Recommendation, evidence type, and pronunciation must apply to the same nickname. Research labels describe evidence, not your taste or identical pronunciation. An attested nickname may be documented in only one language.</p>
        </div></details>}
        {has(["passport", "risk", "riskLanguages"]) && <details className="nf-group"><summary>Documents and associations <ChevronDown size={16}/></summary><div className="nf-group-content">
          {selectField("passport", [{ value: "any", label: "Any Latin spelling comparison" }, { value: "match", label: "Default Latin spelling matches*" }, { value: "mismatch", label: "Default Latin spelling differs" }], "Passport spellings")}
          {selectField("risk", [{ value: "any", label: "Any review result" }, { value: "flagged", label: "Has a noted association" }, { value: "none", label: "No association noted in this review" }, { value: "high", label: "Has a prominent association" }, { value: "medium-up", label: "Medium or high significance" }], "Lexical / historical associations")}
          {arrayField("riskLanguages", [...languageOptions, { value: "cross", label: "Across languages" }], "Language of the noted association")}
          <p className="nf-help">* Based on the chosen Cyrillic spelling. Significance and language apply to the same record. A review is limited; an unflagged name is not guaranteed to avoid teasing. With “no association noted,” selected languages define the scope; no selection checks all languages.</p>
        </div></details>}
        {has(["jewish", "postSoviet", "armenian", "kazakhstan"]) && <details className="nf-group"><summary>Cultural evidence <ChevronDown size={16}/></summary><div className="nf-group-content">
          {arrayField("jewish", evidenceOptions, "Jewish / Israeli context")}
          {arrayField("postSoviet", evidenceOptions, "Non-Slavic post-Soviet contexts")}
          {selectField("armenian", [{ value: "any", label: "Any result" }, { value: "yes", label: "Recorded in Armenian births, 2025" }, { value: "no", label: "No such birth record noted" }], "Armenia · recent births")}
          {selectField("kazakhstan", [{ value: "any", label: "Any result" }, { value: "yes", label: "1,000+ exact-form bearers in one group" }, { value: "no", label: "No such 1,000+ record noted" }], "Kazakhstan · 2021 census")}
          <p className="nf-help">The group, year, and exact form matter. Census data include different ages; Armenian birth data do not establish ethnicity. “Not established” does not mean unused.</p>
        </div></details>}
        {has(["notes", "selected", "league", "minLength", "maxLength"]) && <details className="nf-group"><summary>Organize the list <ChevronDown size={16}/></summary><div className="nf-group-content">
          {selectField("notes", [{ value: "any", label: "With or without notes" }, { value: "yes", label: "Has a shared note" }, { value: "no", label: "No shared note" }], "Shared note")}
          {selectField("selected", [{ value: "any", label: "Any selection" }, { value: "yes", label: "Selected by checkbox" }, { value: "no", label: "Not selected" }], "Selection for a new roster")}
          {selectField("league", [{ value: "any", label: "In or outside the league" }, { value: "in", label: "In the selected league" }, { value: "out", label: "Outside the selected league" }], "League membership")}
          {(visible("minLength") || visible("maxLength")) && <fieldset className="nf-fieldset"><legend>Name length · letters excluding spaces and hyphens</legend><div className="nf-length">
            {visible("minLength") && <label htmlFor={uid + "-min"}>From<input id={uid + "-min"} type="number" min={1} max={80} value={f.minLength ?? ""} placeholder="Any" onChange={e => change("minLength", e.target.value)}/></label>}
            {visible("maxLength") && <label htmlFor={uid + "-max"}>To<input id={uid + "-max"} type="number" min={1} max={80} value={f.maxLength ?? ""} placeholder="Any" onChange={e => change("maxLength", e.target.value)}/></label>}
          </div></fieldset>}
        </div></details>}
      </div>
      <button type="button" className="secondary nf-clear-bottom" onClick={() => onChange(defaultNameFilters())}>Reset all criteria</button>
    </details>
  </section>;
}

export default NameFilterPanel;
