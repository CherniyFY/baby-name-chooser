"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, CircleHelp, Heart, Leaf, LoaderCircle, Search, SlidersHorizontal, Star, Trophy, Undo2, WifiOff, X } from "lucide-react";
import { names as imported, appConfig } from "../lib/catalog";
import FinalTournament from "./components/FinalTournament";
import NameFilterPanel from "./components/NameFilters";
import SavedNameViews from "./components/SavedNameViews";
import LeaguePairBrowser from "./components/LeaguePairBrowser";
import {defaultNameFilters,normalizeNameFilters,filterNameIds,type NameFilters,type NameFilterContext} from "../lib/name-filters";
import "./components/BrowsingViews.css";
import {NameResearch,ResearchBrowser,ResearchBadges,useFamilyProfile,passportData,cultureData,shortData,pronunciationData,researchSources} from "./components/NameResearch";
import { allPairs, consensusStandings, condorcetWinner, leagueProgress, pairKey, standings } from "../lib/league";
import type { Choice, League, Pair, Person, Rating, SharedState } from "../lib/types";

type Name = typeof imported[number];
type Tab = "names" | "league" | "results" | "tournament" | "research";
const names = imported as Name[];
const byId = new Map(names.map(n => [n.id, n]));
const labels: Record<Rating, string> = { neutral: "Unrated", love: "Love", like: "Like", maybe: "Maybe", dismissed: "Set aside", veto: "No" };
const persons: Record<Person, string> = appConfig.participants;
const ratingOrder: Rating[] = ["love", "like", "maybe", "dismissed", "veto", "neutral"];
const weights: Record<Rating, number> = { love: 3, like: 2, maybe: 1, neutral: 0, dismissed: -2, veto: -5 };
const initialState: SharedState = { ratings: Object.fromEntries(names.map(n => [n.id, n.initialRatings])) as SharedState["ratings"], notes: {}, leagues: [], votes: [], updatedAt: "" };
const normalize = (s: string) => s.toLocaleLowerCase().replaceAll("ё", "е");
const isPositive = (r: Rating) => r === "like" || r === "love";
const excluded = (r: Record<Person, Rating>) => [r.first, r.second].some(x => x === "dismissed" || x === "veto");
const fmt = (n: number) => n.toLocaleString("en");
const percent = (n: number | null) => n === null ? "—" : `${Math.round(n * 100)}%`;

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
function csvCell(value: unknown) {
  const s = String(value ?? "");
  const safe = /^[\s]*[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
}
function ratingIcon(r: Rating) { return r === "love" ? "♥" : r === "like" ? "+" : r === "maybe" ? "?" : r === "dismissed" ? "↷" : r === "veto" ? "×" : "○"; }

export default function Home() {
  const [state, setState] = useState<SharedState>(initialState);
  const [person, setPerson] = useState<Person>("first");
  const [tab, setTab] = useState<Tab>("names");
  const [nameFilters,setNameFilters]=useState(()=>defaultNameFilters({family:'active'}));
  const [resultFilters,setResultFilters]=useState(()=>defaultNameFilters());
  const [poolFilters,setPoolFilters]=useState(()=>defaultNameFilters());
  const [sort,setSort]=useState('alphabet');
  const [poolSource,setPoolSource]=useState<'filters'|'selected'|'all'>('filters');
  const [poolOmitted,setPoolOmitted]=useState<Set<string>>(new Set());
  const [poolLimit,setPoolLimit]=useState(20);
  const [viewsLoaded,setViewsLoaded]=useState(false);
  const [resultRank,setResultRank]=useState('all');
  const [resultGames,setResultGames]=useState('all');
  const [resultRecord,setResultRecord]=useState('all');
  const [resultMinBalance,setResultMinBalance]=useState('');
  const [resultSort,setResultSort]=useState('rank');
  const [leagueListQuery,setLeagueListQuery]=useState('');
  const [leagueListStatus,setLeagueListStatus]=useState('all');
  const [limit, setLimit] = useState(24);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Name | null>(null);
  const [detailMode,setDetailMode]=useState<"overview"|"research">("overview");
  const [note, setNote] = useState("");
  const [noteBase, setNoteBase] = useState("");
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [activeLeague, setActiveLeague] = useState("");
  const [leagueTitle, setLeagueTitle] = useState("");
  const [largeConfirmed, setLargeConfirmed] = useState(false);
  const [preferredPair, setPreferredPair] = useState<string | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [resultPerson, setResultPerson] = useState<Person | "both" | "consensus">("both");
  const [toast, setToast] = useState("");
  const [historyLimit, setHistoryLimit] = useState(8);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const fetchSeq = useRef(0);
  const retryRef = useRef<null | (() => Promise<void>)>(null);
  const detailIdRef = useRef<string | null>(null);
  detailIdRef.current = detail?.id ?? null;
  const mutationBlocked = busy || !ready || !!retryRef.current;
  const familyModel=useFamilyProfile(ready && appConfig.researchEnabled);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet && busyRef.current) return;
    const seq = ++fetchSeq.current;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.status === 401) { setAuth(true); throw new Error("Reload and sign in to see shared ratings and save your choices."); }
      if (!response.ok) throw new Error("Could not load shared ratings. Check your connection and retry.");
      const next = await response.json() as SharedState;
      if (seq === fetchSeq.current) {
        setState(next); setReady(true); setAuth(false); setLastSync(new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }));
        if (!retryRef.current) setError("");
      }
    } catch (e) { if (seq === fetchSeq.current) setError(e instanceof Error ? e.message : "Connection error."); }
  }, []);

  useEffect(() => {
    try { const p = localStorage.getItem("name-garden-person"); if (p === "first" || p === "second") setPerson(p); const league = localStorage.getItem("name-garden-league"); if (league) setActiveLeague(league); } catch { /* local preference unavailable */ }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, 10000);
    const onFocus = () => void refresh(true);
    window.addEventListener("focus", onFocus); window.addEventListener("online", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); };
  }, [refresh]);
  useEffect(()=>{
    try{const saved=JSON.parse(localStorage.getItem('name-garden-browsing-v4')||'null');if(saved){setNameFilters(normalizeNameFilters(saved.names));setResultFilters(normalizeNameFilters(saved.results));setPoolFilters(normalizeNameFilters(saved.pool));if(['alphabet','alphabet-desc','br','mutual','first','second','length','household','pronunciation'].includes(saved.sort))setSort(saved.sort);if(['rank','alphabet','balance','points','played'].includes(saved.resultSort))setResultSort(saved.resultSort);if(Array.isArray(saved.selectedIds))setSelected(new Set(saved.selectedIds.filter((id:unknown):id is string=>typeof id==='string'&&byId.has(id))));if(['filters','selected','all'].includes(saved.poolSource))setPoolSource(saved.poolSource);}}catch{}
    setViewsLoaded(true);
  },[]);
  useEffect(()=>{if(viewsLoaded)try{localStorage.setItem('name-garden-browsing-v4',JSON.stringify({names:nameFilters,results:resultFilters,pool:poolFilters,sort,resultSort,selectedIds:[...selected],poolSource}))}catch{}},[viewsLoaded,nameFilters,resultFilters,poolFilters,sort,resultSort,selected,poolSource]);
  useEffect(() => { setLimit(24); }, [nameFilters,sort,person]);
  useEffect(()=>{setPoolLimit(20);setLargeConfirmed(false)},[poolFilters,poolSource,selected,poolOmitted,nameFilters]);
  useEffect(() => {
    if (detail && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    if (!detail && dialogRef.current?.open) dialogRef.current.close();
  }, [detail]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(t); }, [toast]);

  async function mutate(path: string, body: object, method = "POST", after?: (data: any) => void) {
    if (busyRef.current || retryRef.current) return;
    const operation = async () => {
      busyRef.current = true; setBusy(true); setError(""); ++fetchSeq.current;
      try {
        const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (response.status === 401) { setAuth(true); throw new Error("Reload and sign in to save your choice."); }
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "Change not saved. Please retry.");
        retryRef.current = null; after?.(data); await refresh();
      } catch (e) { retryRef.current = operation; setError(e instanceof Error ? e.message : "Change not saved. Please retry."); }
      finally { busyRef.current = false; setBusy(false); }
    };
    await operation();
  }
  function changePerson(next: Person) { setHistoryLimit(8); setPerson(next); setPreferredPair(null); setSkip(new Set()); try { localStorage.setItem("name-garden-person", next); } catch {} }
  function chooseLeague(id: string) { setHistoryLimit(8); setActiveLeague(id); setPreferredPair(null); setSkip(new Set()); try { localStorage.setItem("name-garden-league", id); } catch {} }
  function openDetail(n: Name,mode:"overview"|"research"="overview") { setDetailMode(mode); setDetail(n); setNote(state.notes[n.id] || ""); setNoteBase(state.notes[n.id] || ""); }
  function selectIds(ids:string[],mode:'add'|'remove'|'replace'){
    setSelected(old=>{const next=mode==='replace'?new Set<string>():new Set(old);for(const id of ids)if(byId.has(id)){if(mode==='remove')next.delete(id);else next.add(id)}return next});
    if(mode==='replace'||poolSource!=='selected')setPoolOmitted(new Set());else setPoolOmitted(old=>new Set([...old].filter(id=>!ids.includes(id))));setPoolSource('selected');setLargeConfirmed(false);
  }
  function toggleSelect(id:string){selectIds([id],selected.has(id)?'remove':'add');}
  const ratings = (id: string): Record<Person, Rating> => state.ratings[id] || initialState.ratings[id] || { first: "neutral", second: "neutral" };
  const counts = useMemo(() => ({
    active: names.filter(n => !excluded(state.ratings[n.id] || n.initialRatings as Record<Person, Rating>)).length,
    mutual: names.filter(n => { const r = state.ratings[n.id] || n.initialRatings as Record<Person, Rating>; return isPositive(r.first) && isPositive(r.second); }).length,
    favorites: names.filter(n => (state.ratings[n.id] || n.initialRatings as Record<Person, Rating>)[person] === "love").length,
    later: names.filter(n => { const r = state.ratings[n.id] || n.initialRatings as Record<Person, Rating>; return r.first === "dismissed" || r.second === "dismissed"; }).length,
    veto: names.filter(n => { const r = state.ratings[n.id] || n.initialRatings as Record<Person, Rating>; return r.first === "veto" || r.second === "veto"; }).length,
    all: names.length,
  }), [state.ratings, person]);
  // Catalog changes can leave older records in shared storage or in-flight responses.
  const compatibleLeagues = useMemo(() => state.leagues.filter(l => l.nameIds.every(id => byId.has(id))), [state.leagues]);
  const compatibleVotes = useMemo(() => {
    const ids = new Set(compatibleLeagues.map(l => l.id));
    return state.votes.filter(v => ids.has(v.leagueId) && byId.has(v.a) && byId.has(v.b));
  }, [state.votes, compatibleLeagues]);
  const league = compatibleLeagues.find(l => l.id === activeLeague) || compatibleLeagues[0];
  const leagueVotes = compatibleVotes.filter(v => v.leagueId === league?.id);
  const filterContext=useMemo<NameFilterContext>(()=>({person,ratings:state.ratings,notes:state.notes,selectedIds:[...selected],leagueIds:league?.nameIds}),[person,state.ratings,state.notes,selected,league]);
  const filtered=useMemo(()=>{
    const rows=filterNameIds(names.map(n=>n.id),nameFilters,filterContext).map(id=>byId.get(id)!);
    const mutual=(n:Name)=>{const r=state.ratings[n.id]||n.initialRatings;return [Math.min(weights[r.first as Rating],weights[r.second as Rating]),weights[r.first as Rating]+weights[r.second as Rating]]};
    return rows.sort((a,b)=>{
      let diff=0;
      if(sort==='mutual'){const av=mutual(a),bv=mutual(b);diff=bv[0]-av[0]||bv[1]-av[1]}
      if(sort==='first'||sort==='second')diff=weights[ratings(b.id)[sort]]-weights[ratings(a.id)[sort]];
      if(sort==='length')diff=a.name.length-b.name.length;
      if(sort==='household')diff=Number(!!shortData[b.id]?.bestSharedRu)-Number(!!shortData[a.id]?.bestSharedRu);
      if(sort==='pronunciation')diff=Number(pronunciationData[b.id]?.reviewLevel==='researched')-Number(pronunciationData[a.id]?.reviewLevel==='researched');
      if(sort==='br')return a.br.localeCompare(b.br,'en')||a.name.localeCompare(b.name,'en');
      return diff||(sort==='alphabet-desc'?-1:1)*a.name.localeCompare(b.name,'en');
    });
  },[nameFilters,filterContext,sort,state.ratings]);
  const hiddenSelected=names.filter(n=>selected.has(n.id)&&!filtered.some(f=>f.id===n.id)).length;
  const poolBase=poolSource==='all'?names:poolSource==='selected'?names.filter(n=>selected.has(n.id)):filtered;
  const pool=filterNameIds(poolBase.map(n=>n.id),poolFilters,filterContext).filter(id=>!poolOmitted.has(id)).map(id=>byId.get(id)!);
  const poolPairs=pool.length*(pool.length-1)/2;
  const poolSignature=pool.map(n=>n.id).join(':');
  useEffect(()=>setLargeConfirmed(false),[poolSignature]);
  const pairs = useMemo(() => league ? allPairs(league.nameIds) : [], [league]);
  const ownVotes = leagueVotes.filter(v => v.person === person);
  const voteByPair = new Map(ownVotes.map(v => [pairKey(v.a, v.b), v]));
  const pendingPairs = pairs.filter(p => !voteByPair.has(pairKey(p.a, p.b)));
  const currentPair = pairs.find(p => pairKey(p.a, p.b) === preferredPair) || pendingPairs.find(p => !skip.has(pairKey(p.a, p.b))) || pendingPairs[0];
  const progress = league ? leagueProgress(league, leagueVotes) : null;
  useEffect(()=>{if(!preferredPair)return;const frame=requestAnimationFrame(()=>document.querySelector('.match-heading')?.scrollIntoView({behavior:'smooth',block:'center'}));return()=>cancelAnimationFrame(frame)},[preferredPair]);
  const pairIndex = currentPair ? pairs.findIndex(p => pairKey(p.a, p.b) === pairKey(currentPair.a, currentPair.b)) : 0;
  const flipped = (pairIndex + (person === "second" ? 1 : 0)) % 2 === 1;
  const leftId = currentPair ? flipped ? currentPair.b : currentPair.a : "";
  const rightId = currentPair ? flipped ? currentPair.a : currentPair.b : "";
  const left = byId.get(leftId), right = byId.get(rightId);
  const currentVote = currentPair ? voteByPair.get(pairKey(currentPair.a, currentPair.b)) : undefined;
  const recentVotes = [...ownVotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const results = league ? (resultPerson === "consensus" ? consensusStandings(league.nameIds, leagueVotes) : standings(league.nameIds, leagueVotes, resultPerson === "both" ? undefined : resultPerson)) : [];
  const winner = league && progress?.complete ? condorcetWinner(league.nameIds, leagueVotes, resultPerson === "first" || resultPerson === "second" ? resultPerson : undefined) : null;
  const rowConsensus = league ? new Map(consensusStandings(league.nameIds, leagueVotes).map(r => [r.nameId, r])) : new Map();
  const resultIds=new Set(filterNameIds(results.map(r=>r.nameId),resultFilters,filterContext));
  const visibleResults=results.filter(r=>{
    if(!resultIds.has(r.nameId))return false;
    if(resultRank!=='all'&&r.rank>Number(resultRank))return false;
    if(resultGames==='none'&&r.played!==0||resultGames==='partial'&&(!r.played||r.played>=r.possible)||resultGames==='complete'&&r.played!==r.possible)return false;
    if(resultRecord==='unbeaten'&&(!r.played||r.losses!==0)||resultRecord==='no-wins'&&(!r.played||r.wins!==0)||resultRecord==='draws'&&r.draws===0)return false;
    if(resultMinBalance!==''&&(rowConsensus.get(r.nameId)?.consensus??-1)<Number(resultMinBalance)/100)return false;
    return true;
  }).sort((a,b)=>resultSort==='alphabet'?byId.get(a.nameId)!.name.localeCompare(byId.get(b.nameId)!.name,'en'):resultSort==='balance'?(rowConsensus.get(b.nameId)?.consensus??-1)-(rowConsensus.get(a.nameId)?.consensus??-1)||a.rank-b.rank:resultSort==='points'?b.points-a.points||a.rank-b.rank:resultSort==='played'?b.played-a.played||a.rank-b.rank:0);
  const availableLeagues=compatibleLeagues.filter(l=>{
    if(leagueListQuery&&!normalize(l.title).includes(normalize(leagueListQuery)))return false;
    const p=leagueProgress(l,compatibleVotes);return leagueListStatus==='all'||leagueListStatus==='complete'&&p.complete||leagueListStatus==='pending'&&!p.complete||leagueListStatus==='mine'&&p[person]<p.total;
  });
  const currentPoolExcluded = league?.nameIds.filter(id => excluded(ratings(id))).length || 0;
  const researchLeaders = league ? consensusStandings(league.nameIds, leagueVotes).filter(r => !excluded(ratings(r.nameId))).slice(0,8).map(r=>r.nameId) : [];
  const researchLeaderLabel = league ? `League “${league.title}” · ${progress?.complete ? "complete" : "provisional"} · ranked by the lower of your support scores` : undefined;
  const noteChangedElsewhere = !!detail && (state.notes[detail.id] || "") !== noteBase;
  function castVote(choice: Choice) {
    if (!league || !currentPair) return;
    void mutate("/api/vote", { leagueId: league.id, person, a: currentPair.a, b: currentPair.b, choice }, "POST", () => { setPreferredPair(null); setSkip(new Set()); });
  }
  function createLeague() {
    void mutate("/api/league", { requestId: crypto.randomUUID(), nameIds: pool.map(n => n.id), title: leagueTitle.trim() || `Our shortlist · ${new Date().toLocaleDateString("en")}` }, "POST", d => { chooseLeague(d.league.id); setSelected(new Set()); setToast("League created. You each have an independent vote."); });
  }
  async function exportData(format: "json" | "csv") {
    try {
      const paths = ["/api/state", "/api/tournament", "/api/family", "/api/filter-views"];
      const responses = await Promise.all(paths.map(path => fetch(path, { cache: "no-store" })));
      if (responses.some(response => !response.ok)) throw new Error("Backup not created: some shared data could not be loaded. Please retry.");
      const [latest, tournaments, family, filterViews] = await Promise.all(responses.map(response => response.json())) as [SharedState, unknown, unknown, unknown];
      if (format === "json") {
        download("name-garden.json", JSON.stringify({ exportedAt: new Date().toISOString(), config: appConfig, names, state: latest, tournaments, family, filterViews, ...(appConfig.researchEnabled ? { research: { passports: passportData, cultural: cultureData, shortforms: shortData, pronunciations: pronunciationData, sources: researchSources } } : {}) }, null, 2), "application/json;charset=utf-8");
      } else {
        const rows = [["ID", "Name", "Alternative spelling", "English form", "Meaning", persons.first, persons.second, "Shared note"], ...names.map(n => [n.id, n.name, n.br, n.en, n.origin_meaning, labels[latest.ratings[n.id].first], labels[latest.ratings[n.id].second], latest.notes[n.id] || ""])];
        download("name-garden.csv", "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Export failed. Please retry."); }
  }
  function renderRatingControls(n: Name, compact = false) {
    return <div className={`rating-actions ${compact ? "compact" : ""}`} aria-label={`Your rating for ${n.name}`}>
      {ratingOrder.map(value => <button key={value} className={`rating-button rating-${value} ${ratings(n.id)[person] === value ? "chosen" : ""}`} disabled={mutationBlocked} aria-pressed={ratings(n.id)[person] === value} title={`${persons[person]}: ${labels[value]}`} onClick={() => void mutate("/api/rating", { nameId: n.id, person, value })}><span aria-hidden="true">{ratingIcon(value)}</span>{value === "neutral" ? "Reset" : value === "dismissed" ? "Set aside" : labels[value]}</button>)}
    </div>;
  }
  function renderPairCard(n: Name, side: "left" | "right") {
    const isChosen = currentVote && currentVote.choice !== "tie" && (currentVote.choice === "a" ? currentVote.a : currentVote.b) === n.id;
    return <div className={`pair-card ${isChosen ? "voted" : ""}`}>
      <span className="eyebrow">{side === "left" ? "First name" : "Second name"}</span><h2>{n.name}</h2>{appConfig.researchEnabled && <div className="pair-spellings"><p><span>BR</span>{n.br}</p><p><span>EN</span>{n.en}</p></div>}<p className="pair-nickname">{appConfig.researchEnabled ? shortData[n.id]?.bestSharedRu || n.nicknames.ru : [...new Set(Object.values(n.nicknames).filter(Boolean))].join(" · ")}</p>
      {excluded(ratings(n.id)) && <p className="pool-alert">Currently set aside or marked No</p>}
      <button className="text-button" onClick={() => openDetail(n)}>Name details and short forms <ArrowRight size={15}/></button>
      <button className="primary pair-pick" disabled={mutationBlocked} onClick={() => castVote(currentPair?.a === n.id ? "a" : "b")}><Heart size={18}/> Choose {n.name}</button>
    </div>;
  }


  function closeDetail() {
    if (note !== noteBase && !window.confirm("Close without saving this note?")) return;
    setDetail(null);
  }
  const leagueSelector = league && <label>League<select value={league.id} onChange={e => chooseLeague(e.target.value)}>{league && !availableLeagues.some(l => l.id === league.id) && <option value={league.id}>{league.title} · outside current search</option>}{availableLeagues.map(l => <option key={l.id} value={l.id}>{l.title} · {l.nameIds.length} names</option>)}</select></label>;
  const selectActions = (ids: string[]) => <div className="selection-actions"><button className="secondary" disabled={!ids.length} onClick={() => selectIds(ids, "add")}>Add matches ({ids.length})</button><button className="text-button" disabled={!selected.size} onClick={() => selectIds(ids, "remove")}>Remove matches from selection</button><button className="text-button" disabled={!ids.length} onClick={() => selectIds(ids, "replace")}>Select only these names</button></div>;

  return <div className="app-shell">
    <header className="masthead">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab("names"); }}><span className="brand-mark"><Leaf size={22}/></span><span>{appConfig.title}<small>A SHARED SHORTLIST</small></span></a>
      <div className="header-right"><span className={`sync-state ${error ? "sync-error" : ""}`} role="status">{busy ? <LoaderCircle className="spin" size={15}/> : error ? <WifiOff size={15}/> : ready ? <CheckCheck size={15}/> : <LoaderCircle className="spin" size={15}/>}<span>{busy ? "Saving…" : error ? "Sync paused" : ready ? `Saved · ${lastSync}` : "Connecting…"}</span></span><label className={`person-select person-${person}`}><span className="avatar">{persons[person].slice(0,1)}</span><select disabled={busy || !!retryRef.current} aria-label="Whose ratings am I entering?" value={person} onChange={e => changePerson(e.target.value as Person)}>{(["first", "second"] as Person[]).map(p => <option key={p} value={p}>{persons[p]}</option>)}</select><ChevronDown size={14}/></label></div>
    </header>
    <div className="intro-line"><span>A name. Two voices. One shared decision.</span><span className="private-label"><span/> Your shared space</span></div>
    {error && <div className="error-banner" role="alert"><WifiOff size={20}/><div><strong>{retryRef.current ? "Your last change has not been saved" : "Shared data is unavailable"}</strong><p>{error}</p></div>{auth ? <a className="primary" href="/" target="_top">Reload and sign in</a> : <button className="secondary" disabled={busy} onClick={() => retryRef.current ? void retryRef.current() : void refresh()}>Retry</button>}</div>}
    <nav className="main-nav" aria-label="Sections">{([["names", "Names"], ["league", "League"], ["results", "Results"], ["tournament", "Final tournament"], ...(appConfig.researchEnabled ? [["research", "RU/BR/EN research"]] : [])] as [Tab, string][]).map(([id, label], index) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span>0{index + 1}</span>{label}{id === "names" && <b>{counts.active}</b>}</button>)}</nav>

    <main hidden={tab !== "names"}>
      <section className="hero"><div><p className="eyebrow">FINDING YOUR SHORTLIST</p><h1>Start with a feeling.<br/><em>Find common ground.</em></h1><p className="hero-copy">Rate names independently. Notice where you agree.<br className="desktop-break"/> Then compare your shortlist, two names at a time.</p></div><aside className="hero-note"><span className="note-star">✳</span><strong>{counts.active}<small>names in play</small></strong><p>of {names.length} in your collection</p><div className="note-rule"/><span className="note-detail">Every rating can change.<br/>Setting a name aside is reversible.</span></aside></section>
      <section className="browse-tools" aria-label="Name filters"><NameFilterPanel value={nameFilters} onChange={setNameFilters} context={filterContext} ids={names.map(n => n.id)} title="Find your names"/><div className="browse-sort"><label>Name order<select aria-label="Name order" value={sort} onChange={e => setSort(e.target.value)}><option value="alphabet">A → Z</option><option value="alphabet-desc">Z → A</option>{appConfig.researchEnabled && <option value="br">Brazilian spelling</option>}<option value="mutual">Shared interest first</option><option value="first">{persons.first}’s ratings first</option><option value="second">{persons.second}’s ratings first</option><option value="length">Shortest first</option>{appConfig.researchEnabled && <><option value="household">Reviewed short forms first</option><option value="pronunciation">Detailed pronunciation first</option></>}</select></label><p>Filters from different groups apply together.</p></div><SavedNameViews scope="names" value={nameFilters} sort={sort} onChange={(f, order) => { setNameFilters(f); if (order && ["alphabet", "alphabet-desc", "br", "mutual", "first", "second", "length", "household", "pronunciation"].includes(order)) setSort(order); }} disabled={!ready}/></section>
      <div className="selection-toolbar"><p><strong>{filtered.length} of {names.length} names match</strong> · showing {Math.min(limit, filtered.length)} · rating as {persons[person]}</p><p>Selected: <strong>{selected.size}</strong>{hiddenSelected > 0 && <span className="selection-hidden"> · {hiddenSelected} outside current filters</span>}</p>{selectActions(filtered.map(n => n.id))}<div className="selection-actions">{filtered.length > limit && <button className="secondary" onClick={() => selectIds(filtered.slice(0,limit).map(n => n.id), "add")}>Add this page only ({limit})</button>}<button className="text-button" disabled={!selected.size} onClick={() => selectIds([], "replace")}>Clear selection</button><button className="text-button" disabled={!selected.size} onClick={() => setNameFilters(defaultNameFilters({ selected: "yes" }))}>Show selected</button></div></div>
      <section className="names-grid" aria-label="Names">{filtered.slice(0,limit).map((n,index) => <article key={n.id} className={`name-card ${selected.has(n.id) ? "selected" : ""}`} style={{animationDelay: `${Math.min(index,7) * 35}ms`}}><div className="name-top"><label className="name-checkbox"><input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleSelect(n.id)} aria-label={`Select ${n.name} for a league`}/><span>{selected.has(n.id) ? <Check size={13}/> : ""}</span></label><button className="name-title" onClick={() => openDetail(n)}><h2>{n.name}</h2></button></div>{appConfig.researchEnabled && (n.br || n.en) && <div className="name-spellings">{n.br && <p><span>{appConfig.researchEnabled ? "BR" : "ALTERNATIVE"}</span>{n.br}</p>}{n.en && <p><span>EN</span>{n.en}</p>}</div>}<div className="family-ratings">{(["first", "second"] as Person[]).map(p => <span key={p} className={`status-chip person-${p} status-${ratings(n.id)[p]}`}><i>{persons[p].slice(0,1)}</i>{persons[p]}: {labels[ratings(n.id)[p]]}</span>)}</div>{appConfig.researchEnabled && <ResearchBadges nameId={n.id}/>} {renderRatingControls(n)}<button className="card-detail" onClick={() => openDetail(n)}>Details, short forms and shared note <ArrowRight size={14}/></button></article>)}</section>
      {!filtered.length && <div className="empty-state"><Leaf size={33}/><h2>No names match yet</h2><p>Try changing a filter. You can always bring a name back.</p><button className="secondary" onClick={() => setNameFilters(defaultNameFilters())}>Show every name</button></div>}
      {filtered.length > limit && <div className="show-more"><button className="secondary" onClick={() => setLimit(limit + 24)}>Show {Math.min(24, filtered.length - limit)} more <ChevronDown size={16}/></button><span>{Math.min(limit, filtered.length)} of {filtered.length}</span></div>}
      <div className="league-callout"><div><span className="eyebrow">NEXT STEP</span><h2>{selected.size ? `${selected.size} names for your league` : "Which names make your shortlist?"}</h2><p>{selected.size ? `${fmt(selected.size * (selected.size - 1) / 2)} comparisons each. Review the pool before starting.` : "Select names using the checkboxes. A pool of 8–12 is a manageable start."}</p></div><button className="primary" onClick={() => setTab("league")}>Go to league <ArrowRight size={17}/></button></div>
    </main>

    {tab === "league" && <main className="league-main"><div className="section-intro"><p className="eyebrow">EVERY NAME MEETS EVERY OTHER</p><h1>Small choices.<br/><em>A clearer picture.</em></h1><p>Compare independently. A win earns 3 points; a tie earns 1. Your name ratings stay separate.</p></div>
      {league && progress && <section className="active-league"><div className="league-title-row"><div><span className="eyebrow">CURRENT LEAGUE · {league.nameIds.length} NAMES</span><h2>{league.title}</h2></div><button className="secondary" onClick={() => setTab("results")}><Trophy size={17}/> Results</button></div><div className="league-switch">{leagueSelector}</div><div className="progress-row">{(["first", "second"] as Person[]).map(p => <div key={p} className={`progress-item person-${p}`}><div><span>{persons[p]}</span><strong>{fmt(progress[p])}<small> / {fmt(progress.total)}</small></strong></div><div className="progress-track"><span style={{width: `${progress.total ? progress[p] / progress.total * 100 : 0}%`}}/></div></div>)}</div>{currentPoolExcluded > 0 && <p className="inline-warning"><CircleHelp size={17}/> {currentPoolExcluded} names are now set aside or marked No. This league keeps its original pool.</p>}
        {currentPair && left && right ? <><div className="match-heading"><span className={`person-dot person-${person}`}/><p>Choosing as <strong>{persons[person]}</strong>{currentVote && " · reviewing a vote"}</p><span>{currentVote ? "Vote saved" : `${pendingPairs.length} remaining`}</span></div><div className="pair-grid">{renderPairCard(left, "left")}<div className="versus">or</div>{renderPairCard(right, "right")}</div><div className="match-actions"><button className={`secondary ${currentVote?.choice === "tie" ? "is-active" : ""}`} disabled={mutationBlocked} onClick={() => castVote("tie")}>Like both equally</button><button className="text-button" onClick={() => { setSkip(old => { const next = new Set([...old, pairKey(currentPair.a,currentPair.b)]); return pendingPairs.every(p => next.has(pairKey(p.a,p.b))) ? new Set() : next; }); setPreferredPair(null); }}>Later <ArrowRight size={15}/></button>{currentVote && <button className="text-button" disabled={mutationBlocked} onClick={() => void mutate("/api/vote", {leagueId:league.id,person,a:currentPair.a,b:currentPair.b}, "DELETE", () => setPreferredPair(null))}><Undo2 size={15}/> Remove vote</button>}</div><p className="match-note">Later leaves the comparison unanswered. Votes do not change name ratings or eliminate names.</p></> : <div className="complete-state"><span>✳</span><h2>You have compared every pair</h2><p>{progress.complete ? "Both of you have finished. Take a look at the results together." : `${persons[person]} has finished. The other participant can continue at their own pace.`}</p><button className="primary" onClick={() => setTab("results")}>See results <ArrowRight size={17}/></button></div>}
        <LeaguePairBrowser pairs={pairs} votes={leagueVotes} context={filterContext} skippedKeys={skip} onOpen={pair => setPreferredPair(pairKey(pair.a,pair.b))}/>
        {recentVotes.length > 0 && <details className="recent-answers"><summary>Recent votes ({recentVotes.length})</summary><div>{recentVotes.slice(0,historyLimit).map(v => <button key={pairKey(v.a,v.b)} onClick={() => setPreferredPair(pairKey(v.a,v.b))}>{byId.get(v.a)?.name} / {byId.get(v.b)?.name}<span>{v.choice === "tie" ? "Tie" : byId.get(v.choice === "a" ? v.a : v.b)?.name}</span></button>)}</div>{recentVotes.length > historyLimit && <button className="text-button" onClick={() => setHistoryLimit(historyLimit + 12)}>Show more votes</button>}</details>}
      </section>}
      <section id="new-league" className="new-league"><div><p className="eyebrow">A NEW ROUND</p><h2>{league ? "Another league" : "Build your first league"}</h2><p>10 names make 45 comparisons each, 90 between you.</p><ol className="howto"><li><span>1</span> Rate names independently.</li><li><span>2</span> Choose a pool and compare every pair.</li><li><span>3</span> Discuss the leaders. The final decision is yours.</li></ol></div><div className="league-config"><label className="field-label">League title<input value={leagueTitle} onChange={e => setLeagueTitle(e.target.value)} maxLength={120} placeholder="For example, our first shortlist"/></label><label className="pool-source">Start with<select value={poolSource} onChange={e => { setPoolSource(e.target.value as typeof poolSource); setPoolOmitted(new Set()); }}><option value="filters">Names in the current browsing filters</option><option value="selected">Selected names</option><option value="all">All names</option></select></label><NameFilterPanel value={poolFilters} onChange={setPoolFilters} context={filterContext} ids={poolBase.map(n => n.id)} title="Narrow your league pool" compact/><div className="pool-preview"><span>Proposed pool</span><strong>{pool.length}<small> names</small></strong><p>{fmt(poolPairs)} comparisons each · {fmt(poolPairs * 2)} in total</p><div className="pool-names">{pool.slice(0,poolLimit).map(n => <span key={n.id}>{n.name}<button aria-label={`Omit ${n.name} from this proposal`} onClick={() => setPoolOmitted(old => new Set([...old,n.id]))}><X size={12}/></button></span>)}</div>{pool.length > poolLimit && <button className="text-button" onClick={() => setPoolLimit(pool.length)}>Review all {pool.length} names</button>}{poolOmitted.size > 0 && <button className="text-button" onClick={() => setPoolOmitted(new Set())}>Restore omitted names</button>}</div>{pool.length > 20 && <label className="large-confirm"><input type="checkbox" checked={largeConfirmed} onChange={e => setLargeConfirmed(e.target.checked)}/><span>I understand this pool needs {fmt(poolPairs)} comparisons from each participant.</span></label>}<button className="primary create-league" disabled={mutationBlocked || pool.length < 2 || pool.length > 20 && !largeConfirmed} onClick={createLeague}>Start league <ArrowRight size={17}/></button><p className="config-note">The pool is fixed when the league starts. Ratings and previous leagues are preserved.</p></div></section>
    </main>}

    <main hidden={tab !== "results"} className="results-main"><div className="section-intro"><p className="eyebrow">TWO PERSPECTIVES, ONE SHORTLIST</p><h1>See where<br/><em>you meet.</em></h1><p>Standings reveal preferences. You choose the name.</p></div>{league && progress ? <><div className="league-list-search"><input aria-label="Search leagues" placeholder="Find a league…" value={leagueListQuery} onChange={e => setLeagueListQuery(e.target.value)}/><select aria-label="League status" value={leagueListStatus} onChange={e => setLeagueListStatus(e.target.value)}><option value="all">All leagues</option><option value="complete">Both finished</option><option value="pending">Comparisons remaining</option><option value="mine">I have pairs left</option></select></div><div className="league-switch">{leagueSelector}<button className="primary" onClick={() => setTab("league")}>Continue comparing <ArrowRight size={16}/></button></div><div className={`result-status ${progress.complete ? "finished" : ""}`}><CheckCheck size={22}/><div><strong>{progress.complete ? "Every comparison is complete" : "Provisional results"}</strong><p>{persons.first}: {fmt(progress.first)} / {fmt(progress.total)} · {persons.second}: {fmt(progress.second)} / {fmt(progress.total)}{!progress.complete && ". Names have played different numbers of matches. Positions may change."}</p></div></div><div className="result-tabs">{([["both","Combined"],["first",persons.first],["second",persons.second],["consensus","Shared support"]] as [typeof resultPerson,string][]).map(([value,label]) => <button key={value} className={resultPerson === value ? "active" : ""} onClick={() => setResultPerson(value)}>{label}</button>)}</div><div className="results-selection"><NameFilterPanel value={resultFilters} onChange={setResultFilters} context={filterContext} ids={league.nameIds} title="Filter the standings"/><SavedNameViews scope="results" value={resultFilters} sort={resultSort} onChange={(f,order) => { setResultFilters(f); if (order && ["rank","alphabet","balance","points","played"].includes(order)) setResultSort(order); }} disabled={!ready}/><p className="results-filters-note">Additional standings filters</p><div className="view-filter-grid"><label>Rank<select value={resultRank} onChange={e => setResultRank(e.target.value)}><option value="all">Every rank</option>{[3,5,8,10].map(value => <option key={value} value={value}>Top {value}</option>)}</select></label><label>Completion<select value={resultGames} onChange={e => setResultGames(e.target.value)}><option value="all">Any progress</option><option value="none">No comparisons yet</option><option value="partial">Partly compared</option><option value="complete">Fully compared</option></select></label><label>Record<select value={resultRecord} onChange={e => setResultRecord(e.target.value)}><option value="all">Any record</option><option value="unbeaten">Played, no losses</option><option value="no-wins">Played, no wins</option><option value="draws">Has a tie</option></select></label><label>Minimum shared support<select value={resultMinBalance} onChange={e => setResultMinBalance(e.target.value)}><option value="">Any</option>{[25,50,60,75].map(value => <option key={value} value={value}>{value}%</option>)}</select></label><label>Order<select value={resultSort} onChange={e => setResultSort(e.target.value)}><option value="rank">Original rank</option><option value="alphabet">Alphabetical</option><option value="balance">Shared support</option><option value="points">Points</option><option value="played">Comparisons played</option></select></label></div><div className="view-filter-count"><span>Showing {visibleResults.length} of {results.length}. Ranks use the entire league.</span><button className="text-button" onClick={() => { setResultFilters(defaultNameFilters()); setResultRank("all"); setResultGames("all"); setResultRecord("all"); setResultMinBalance(""); setResultSort("rank"); }}>Reset standings filters</button></div>{selectActions(visibleResults.map(row => row.nameId))}</div><div className="results-table-wrap"><table className="results-table"><caption className="sr-only">League standings: 3 points for a win, 1 for a tie, 0 for a loss</caption><thead><tr><th scope="col">Rank</th><th scope="col">Name</th><th scope="col">Played</th><th scope="col">Wins</th><th scope="col">Ties</th><th scope="col">Losses</th><th scope="col">Points</th><th scope="col">Points %</th><th scope="col">Shared support</th></tr></thead><tbody>{visibleResults.map(row => <tr key={row.nameId}><td className="rank-number">{row.rank}</td><th scope="row"><button onClick={() => openDetail(byId.get(row.nameId)!)}>{byId.get(row.nameId)?.name}</button>{appConfig.researchEnabled && <span>{byId.get(row.nameId)?.br}</span>}</th><td>{row.played}<small> / {row.possible}</small></td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td className="points-cell">{row.points}</td><td>{percent(row.pointsRate)}</td><td><span className="consensus-cell">{percent(rowConsensus.get(row.nameId)?.consensus ?? null)}</span></td></tr>)}</tbody></table></div>{!visibleResults.length && <p className="view-empty">No names match this combination. Try removing a filter.</p>}<div className="result-explainer"><p><strong>Standard standings:</strong> a win earns 3 points, a tie 1 and a loss 0. Equal points are ordered by wins; identical records share a rank. Before completion, points percentage accounts for different numbers of games.</p><p><strong>Shared support:</strong> each participant’s score is (wins + ½ ties) / games. The lower score is used, highlighting names supported by both of you. Small samples remain provisional.</p><p>{winner ? <><strong>{byId.get(winner)?.name}</strong> beats every other name head to head in this view.</> : "There is no single name that beats every other name in this view. Ties and preference cycles are possible."}</p><p><button className="secondary" onClick={() => setTab("tournament")}>Build a final tournament <ArrowRight size={16}/></button></p><p>Results never override a manual No rating. Review both participants’ ratings before making a final choice.</p></div></> : <div className="empty-state"><Trophy size={35}/><h2>Your first comparisons go here</h2><p>Create a league from a shortlist. You will each vote independently.</p><button className="primary" onClick={() => setTab("league")}>Build a league <ArrowRight size={17}/></button></div>}</main>

    <div hidden={tab !== "tournament"}><FinalTournament names={names} ratings={state.ratings} leagues={compatibleLeagues} votes={compatibleVotes} person={person} ready={ready} filterContext={filterContext}/></div>
    {appConfig.researchEnabled && <div hidden={tab !== "research"}><ResearchBrowser familyModel={familyModel} onOpenName={id => openDetail(byId.get(id)!,"research")} activeIds={names.filter(n => !excluded(ratings(n.id))).map(n => n.id)} leaderIds={researchLeaders} leaderLabel={researchLeaderLabel} context={filterContext} onSelectIds={selectIds} ready={ready}/></div>}
    <footer className="footer"><div><span className="footer-brand"><Leaf size={16}/> {appConfig.title}</span><p>Make room to hear each other.</p><small>The selected participant labels each rating. Both participants share this space.</small></div><div className="exports"><button onClick={() => void exportData("json")} disabled={!ready}><ArrowDownToLine size={15}/> JSON backup</button><button onClick={() => void exportData("csv")} disabled={!ready}>Export CSV</button></div></footer>
    {selected.size > 0 && tab === "names" && <div className="selection-bar"><span><Check size={17}/><strong>{selected.size}</strong> selected</span><button className="primary" onClick={() => setTab("league")}>Review your pool <ArrowRight size={16}/></button></div>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    <dialog className="name-dialog" aria-labelledby="detail-name" ref={dialogRef} onCancel={e => {e.preventDefault();closeDetail();}} onClick={e => {if(e.target === dialogRef.current)closeDetail();}}>{detail && <div className="dialog-content">{retryRef.current && <div className="error-banner" role="alert"><div><strong>Change not saved</strong><p>{error}</p></div><button className="secondary" disabled={busy} onClick={() => void retryRef.current?.()}>Retry save</button></div>}<button className="dialog-close" aria-label="Close name details" onClick={closeDetail}><X size={22}/></button><p className="eyebrow">NAME DETAILS</p><h2 id="detail-name">{detail.name}</h2>{appConfig.researchEnabled && <div className="detail-spellings">{detail.br && <div><span>{appConfig.researchEnabled ? "Brazilian spelling candidate" : "Alternative spelling"}</span><strong>{detail.br}</strong></div>}{detail.en && <div><span>English form</span><strong>{detail.en}</strong></div>}</div>}<div className="family-ratings">{(["first","second"] as Person[]).map(p => <span key={p} className={`status-chip person-${p} status-${ratings(detail.id)[p]}`}><i>{persons[p].slice(0,1)}</i>{persons[p]}: {labels[ratings(detail.id)[p]]}</span>)}</div><div className="detail-rating"><p>Your rating · {persons[person]}</p>{renderRatingControls(detail,true)}</div>{appConfig.researchEnabled && <div className="detail-tabs"><button className={detailMode === "overview" ? "active" : ""} onClick={() => setDetailMode("overview")}>Details and note</button><button className={detailMode === "research" ? "active" : ""} onClick={() => setDetailMode("research")}>RU/BR/EN research</button></div>}<div hidden={detailMode !== "overview"}><section className="detail-section"><h3>Short forms</h3>{shortData[detail.id]?.bestSharedRu && <p>{shortData[detail.id].bestSharedRu}</p>}{appConfig.researchEnabled ? <dl className="detail-dl">{Object.entries(detail.nicknames).filter(([,value]) => value).map(([language,value]) => <div key={language}><dt>{language.toUpperCase()}</dt><dd>{value}</dd></div>)}</dl> : <p>{[...new Set(Object.values(detail.nicknames).filter(Boolean))].join(" · ") || "No short forms added yet."}</p>}</section>{(detail.origin_meaning || detail.culture_christian_links || detail.notes_popularity) && <section className="detail-section"><h3>Meaning and context</h3><p>{detail.origin_meaning}</p><p>{detail.culture_christian_links}</p><p>{detail.notes_popularity}</p></section>}<section className="detail-section"><h3>Our note</h3><p className="small-copy">Shared between both of you. Record a thought or something to discuss.</p><textarea aria-label="Shared note about this name" value={note} onChange={e => setNote(e.target.value)} maxLength={4000} rows={4} placeholder="For example, love the full name; still discussing the short form…"/>{noteChangedElsewhere && <p className="note-conflict">This note changed on another device. Current shared note: “{state.notes[detail.id] || "empty"}”. Load that version or save your text over it.</p>}<div className="note-actions"><button className="primary" disabled={mutationBlocked || note === noteBase} onClick={() => void mutate("/api/note", {nameId:detail.id,text:note}, "POST", () => {if(detailIdRef.current === detail.id)setNoteBase(note);setToast("Shared note saved");})}>Save note</button>{noteChangedElsewhere && <button className="text-button" onClick={() => {setNote(state.notes[detail.id] || "");setNoteBase(state.notes[detail.id] || "");}}>Load shared version</button>}<span>{note.length} / 4000</span></div></section>{detail.references.length > 0 && <details className="source-details"><summary>Sources</summary>{detail.references.map((reference,index) => <p key={index}>{/^https?:\/\//.test(reference.url) ? <a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.reference} ↗</a> : reference.reference}</p>)}</details>}</div>{appConfig.researchEnabled && <div hidden={detailMode !== "research"}><NameResearch key={detail.id} nameId={detail.id} family={familyModel.family}/></div>}</div>}</dialog>
  </div>;
}
