"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Heart, LoaderCircle, Plus, RotateCcw, Trophy, X } from "lucide-react";
import { appConfig } from "../../lib/catalog";
import type { League, Person, Rating, Vote } from "../../lib/types";
import { getBracket, type Tournament, type TournamentAction, type TournamentMatch } from "../../lib/tournament";
import { suggestTournamentSeeds, tournamentEligible } from "../../lib/tournament-suggestions";
import {defaultNameFilters,filterNameIds,type NameFilterContext} from "../../lib/name-filters";
import NameFilterPanel from "./NameFilters";
import SavedNameViews from "./SavedNameViews";
import "./FinalTournament.css";

export type FinalTournamentProps = {
  names: { id: string; name: string; br: string; en: string }[];
  ratings: Record<string, Record<Person, Rating>>;
  leagues: League[];
  votes: Vote[];
  person: Person;
  ready: boolean;
  filterContext?: NameFilterContext;
};
const personLabel: Record<Person, string> = appConfig.participants;
type Pending = { path: string; payload: object; creation: boolean };

export default function FinalTournament({ names, ratings, leagues, votes, person, ready, filterContext }: FinalTournamentProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeId, setActiveId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [sourceId, setSourceId] = useState("ratings");
  const [seedCount, setSeedCount] = useState(8);
  const [seedIds, setSeedIds] = useState<string[]>([]);
  const [appliedSource, setAppliedSource] = useState({ label: "No entrants selected yet", edited: false, provisional: true });
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation,setConfirmation]=useState<{action:"decide"|"undo";matchId:string;winnerId?:string}|null>(null);
  const [auth, setAuth] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [configOpen, setConfigOpen] = useState(true);
  const [candidateFilters,setCandidateFilters]=useState(()=>defaultNameFilters({family:'active'}));
  const [candidateLimit,setCandidateLimit]=useState(16);
  const [tournamentQuery,setTournamentQuery]=useState('');
  const [tournamentStatus,setTournamentStatus]=useState('any');
  const [matchQuery,setMatchQuery]=useState('');
  const [matchStatus,setMatchStatus]=useState('any');
  const [matchBracket,setMatchBracket]=useState('any');
  const [matchOwn,setMatchOwn]=useState('any');
  const [matchAgreement,setMatchAgreement]=useState('any');
  const [lossFilter,setLossFilter]=useState('any');
  const requestSequence = useRef(0);
  const busyRef = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const initialized = useRef(false);
  const nameMap = useMemo(() => new Map(names.map(n => [n.id, n])), [names]);
  const candidateContext=useMemo<NameFilterContext>(()=>({person,ratings,notes:filterContext?.notes??{},selectedIds:seedIds,leagueIds:leagues.find(l=>l.id===sourceId)?.nameIds??filterContext?.leagueIds}),[person,ratings,filterContext,seedIds,leagues,sourceId]);
  const eligibleNames=useMemo(()=>names.filter(n=>tournamentEligible(ratings[n.id])),[names,ratings]);
  const candidateIds=useMemo(()=>filterNameIds(eligibleNames.map(n=>n.id),candidateFilters,candidateContext),[eligibleNames,candidateFilters,candidateContext]);
  const candidateNames=candidateIds.map(id=>nameMap.get(id)!).sort((a,b)=>a.name.localeCompare(b.name,'en'));
  const candidateAvailable=candidateNames.filter(n=>!seedIds.includes(n.id));
  const suggestions = useMemo(() => suggestTournamentSeeds(candidateIds, ratings, leagues, votes, sourceId, seedCount), [candidateIds, ratings, leagues, votes, sourceId, seedCount]);
  useEffect(()=>{setCandidateLimit(16);setAdding("")},[candidateFilters,sourceId]);

  const refresh = useCallback(async (quiet = false) => {
    if (!ready || quiet && busyRef.current) return;
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch("/api/tournament", { cache: "no-store" });
      if (response.status === 401) { setAuth(true); throw new Error("Reload and sign in to open the shared tournament."); }
      const data = await response.json() as { tournaments?: Tournament[]; error?: string };
      if (!response.ok || !data.tournaments) throw new Error(data.error || "Could not load the tournament.");
      if (sequence === requestSequence.current) { setTournaments(data.tournaments); setLoaded(true); setAuth(false); if (!pendingRef.current) setError(""); }
    } catch (e) { if (sequence === requestSequence.current) setError(e instanceof Error ? e.message : "Could not load the tournament."); }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, 10000);
    const focus = () => void refresh(true);
    window.addEventListener("focus", focus); window.addEventListener("online", focus);
    return () => { clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("online", focus); };
  }, [ready, refresh]);
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    const source = leagues[0]?.id || "ratings";
    setSourceId(source);
    const initial = suggestTournamentSeeds(names.map(n => n.id), ratings, leagues, votes, source, 8);
    setSeedIds(initial.nameIds); setAppliedSource({ label: initial.label, edited: false, provisional: initial.provisional });
    try { const id = localStorage.getItem("name-garden-tournament"); if (id) setActiveId(id); } catch { /* only a device preference */ }
  }, [ready, names, ratings, leagues, votes]);
  useEffect(() => { setMatchId(""); }, [person, activeId]);

  const compatibleTournaments = tournaments.filter(t => t.nameIds.every(id => nameMap.has(id)));
  const tournament = compatibleTournaments.find(t => t.id === activeId) || compatibleTournaments[0];
  const bracket = useMemo(() => tournament ? getBracket(tournament) : null, [tournament]);
  const readyMatches = bracket?.matches.filter(m => m.status === "ready") ?? [];
  const match = readyMatches.find(m => m.id === matchId) || readyMatches.find(m => !m.votes[person]) || readyMatches[0];
  const latest = tournament?.results.at(-1);
  useEffect(()=>setConfirmation(null),[person,activeId,tournament?.revision,match?.id]);
  const disabled = busy || !!pending || !ready;
  const excludedSeeds = seedIds.filter(id => !tournamentEligible(ratings[id]));
  const excludedInTournament = tournament?.nameIds.filter(id => !tournamentEligible(ratings[id])) ?? [];
  const getName = (id: string | null | undefined) => id ? nameMap.get(id)?.name ?? id : "Waiting for an opponent";
  const fold=(value:string)=>value.toLocaleLowerCase().replaceAll('ё','е');
  const tournamentOptions=compatibleTournaments.filter(t=>(!tournamentQuery||fold(t.title+' '+t.nameIds.map(getName).join(' ')).includes(fold(tournamentQuery)))&&(tournamentStatus==='any'||(tournamentStatus==='completed')===!!getBracket(t).championId));
  const visibleMatches=bracket?.matches.filter(m=>{
    if(matchQuery&&!fold(m.id+' '+getName(m.a)+' '+getName(m.b)).includes(fold(matchQuery)))return false;
    if(matchStatus!=='any'&&m.status!==matchStatus)return false;
    if(matchBracket!=='any'&&m.bracket!==matchBracket)return false;
    if(matchOwn==='picked'&&!m.votes[person]||matchOwn==='unpicked'&&!!m.votes[person])return false;
    const both=!!m.votes.first&&!!m.votes.second;
    if(matchAgreement==='agreed'&&(!both||m.votes.first!==m.votes.second))return false;
    if(matchAgreement==='different'&&(!both||m.votes.first===m.votes.second))return false;
    if(matchAgreement==='pending'&&both)return false;
    if(matchAgreement==='joint'&&!tournament?.results.some(r=>r.matchId===m.id&&r.decidedBy==='joint'))return false;
    return true;
  })??[];
  const visibleLossIds=tournament?.nameIds.filter(id=>(lossFilter==='any'||bracket?.losses[id]===Number(lossFilter))&&(!matchQuery||fold(getName(id)).includes(fold(matchQuery))))??[];
  const resetMatchFilters=()=>{setMatchQuery('');setMatchStatus('any');setMatchBracket('any');setMatchOwn('any');setMatchAgreement('any');setLossFilter('any')};
  function changeSeeds(ids:string[],add:boolean){
    if(disabled)return;
    setSeedIds(old=>add?[...old,...ids.filter(id=>!old.includes(id)&&tournamentEligible(ratings[id]))].slice(0,16):old.filter(id=>!ids.includes(id)));
    setAppliedSource(old=>({...old,edited:true}));setAdding('');
  }


  function chooseTournament(id: string) {
    setActiveId(id); setMatchId("");
    try { localStorage.setItem("name-garden-tournament", id); } catch { /* preference only */ }
  }
  async function save(operation: Pending, retry = false) {
    if (busyRef.current || pendingRef.current && !retry) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice(""); ++requestSequence.current;
    try {
      const response = await fetch(operation.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation.payload) });
      const data = await response.json() as { tournament?: Tournament; error?: string };
      if (response.status === 401) setAuth(true);
      if (response.status === 409) {
        pendingRef.current = null; setPending(null);
        setNotice(data.error || "This tournament changed on another device. Check the saved result and try again.");
        await refresh(); return;
      }
      if (!response.ok || !data.tournament) throw new Error(data.error || "Change was not saved. Please try again.");
      const saved = data.tournament;
      setTournaments(old => [saved, ...old.filter(t => t.id !== saved.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      pendingRef.current = null; setPending(null); setAuth(false); setLoaded(true); setMatchId("");
      if (operation.creation) { chooseTournament(saved.id); setConfigOpen(false); setNotice("Tournament created. Entrants and seed order are fixed."); }
    } catch (e) {
      pendingRef.current = operation; setPending(operation);
      setError(e instanceof Error ? e.message : "Change was not saved. Please try again.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  function create() {
    const operation: Pending = { path: "/api/tournament", payload: { requestId: crypto.randomUUID(), title: title.trim() || `Our final · ${new Date().toLocaleDateString("en-US")}`, nameIds: [...seedIds] }, creation: true };
    void save(operation);
  }
  function act(action: TournamentAction) {
    if (!tournament) return;
    setConfirmation(null);
    void save({ path: `/api/tournament/${tournament.id}`, payload: { ...action, revision: tournament.revision }, creation: false });
  }
  function move(index: number, direction: number) {
    setSeedIds(old => { const result = [...old]; [result[index], result[index + direction]] = [result[index + direction], result[index]]; return result; });
    setAppliedSource(old => ({ ...old, edited: true }));
  }
  function nextMatch() {
    if (!match || readyMatches.length < 2) return;
    setMatchId(readyMatches[(readyMatches.findIndex(m => m.id === match.id) + 1) % readyMatches.length].id);
  }
  function renderMatchCard(m: TournamentMatch) {
    return <button key={m.id} className={`ft-bracket-match ft-match-${m.status} ${match?.id === m.id ? "ft-current" : ""}`} disabled={m.status !== "ready" || disabled} onClick={() => setMatchId(m.id)} aria-label={`${m.id}: ${getName(m.a)} and ${getName(m.b)}`}>
      <span className="ft-match-id">{m.id}{m.status === "bye" ? " · bye" : m.status === "done" ? " · complete" : m.status === "ready" ? " · voting" : m.status === "inactive" ? " · if needed" : " · waiting"}</span>
      {[m.a, m.b].map((id, index) => <span key={index} className={`ft-slot ${id && m.winnerId === id ? "ft-slot-winner" : ""}`}>{id ? getName(id) : m.status === "bye" ? "No opponent" : "Waiting for an opponent"}{id && m.winnerId === id && <Check size={13}/>}</span>)}
    </button>;
  }

  return <section className="final-tournament">
    <div className="section-intro"><p className="eyebrow">THE FINAL SHORTLIST</p><h1>Strong contenders get<br/><em>a second chance.</em></h1><p>A tournament with elimination after two losses. Each participant votes independently;<br className="desktop-break"/> if your choices differ, discuss the pair and decide together.</p></div>
    {!ready && <div className="ft-info">Wait for the shared shortlist to connect before saving a tournament.</div>}
    {error && <div className="ft-error" role="alert"><div><strong>{pending ? "Change not yet confirmed" : "Could not load the tournament"}</strong><p>{error}</p></div>{auth ? <a className="primary" href="/" target="_top">Reload and sign in</a> : <button className="secondary" disabled={busy} onClick={() => pending ? void save(pending, true) : void refresh()}>Retry</button>}{pending && <button className="text-button" disabled={busy} onClick={() => { pendingRef.current = null; setPending(null); setError(""); void refresh(); }}>Load saved version</button>}</div>}
    {notice && <p className="ft-notice" role="status">{notice}</p>}
    {busy && <p className="ft-saving" role="status"><LoaderCircle className="spin" size={15}/> Saving the shared tournament…</p>}

    {tournament && bracket && <>
      <div className="ft-library-filters" aria-label="Search tournaments"><label>Tournament title or name<input aria-label="Search shared tournaments" value={tournamentQuery} onChange={e=>setTournamentQuery(e.target.value)} placeholder="Title or entrant…"/></label><label>Status<select aria-label="Tournament status" value={tournamentStatus} onChange={e=>setTournamentStatus(e.target.value)}><option value="any">All tournaments</option><option value="active">In progress</option><option value="completed">Completed</option></select></label><span>{tournamentOptions.length} of {compatibleTournaments.length}</span>{(tournamentQuery||tournamentStatus!=='any')&&<button className="text-button" onClick={()=>{setTournamentQuery('');setTournamentStatus('any')}}>Reset tournament search</button>}</div>
      <div className="ft-toolbar"><label>Shared tournament<select value={tournament.id} onChange={e => chooseTournament(e.target.value)}>{!tournamentOptions.some(t=>t.id===tournament.id)&&<option value={tournament.id}>{tournament.title} · current, outside filter</option>}{tournamentOptions.map(t => <option key={t.id} value={t.id}>{t.title} · {t.nameIds.length} names</option>)}</select></label><button className="text-button" onClick={() => setConfigOpen(!configOpen)}>{configOpen ? "Hide setup" : "Create another tournament"} <Plus size={15}/></button></div>
      {!tournamentOptions.length&&<p className="ft-info">No other tournaments match. The current tournament stays open until you choose another.</p>}
      <div className="ft-title"><div><p className="eyebrow">{tournament.nameIds.length} NAMES · {tournament.results.length} MATCHES COMPLETE</p><h2>{tournament.title}</h2></div>{latest && <button className="secondary" disabled={disabled} onClick={() => setConfirmation({action:"undo",matchId:latest.matchId})}><RotateCcw size={15}/> Undo last match</button>}</div>
      {confirmation && <div className="ft-inline-confirm" role="group" aria-label="Confirm decision"><strong>{confirmation.action==="decide"?`Have you both discussed this pair and chosen “${getName(confirmation.winnerId)}”?`:`Undo last match ${confirmation.matchId}?`}</strong><p>{confirmation.action==="undo"?"Its votes and any unfinished dependent votes will be cleared. Earlier completed matches will remain.":"This joint decision completes the match and determines the next pairing."}</p><button className="primary" disabled={disabled} onClick={()=>act(confirmation.action==="undo"?{action:"undo",matchId:confirmation.matchId}:{action:"decide",matchId:confirmation.matchId,winnerId:confirmation.winnerId!})}>{confirmation.action==="undo"?"Confirm undo":"Confirm joint decision"}</button><button className="secondary" onClick={()=>setConfirmation(null)}>Back to voting</button></div>}
      {excludedInTournament.length > 0 && <p className="ft-info">These entrants are now set aside or vetoed: {excludedInTournament.map(getName).join(", ")}. The tournament keeps its original entrants and does not change ratings. Create another tournament for a different roster.</p>}
      {bracket.championId ? <div className="ft-champion"><Trophy size={29}/><p className="eyebrow">TOURNAMENT WINNER</p><h2>{getName(bracket.championId)}</h2><p>Discuss this name together. Results reflect your votes and seed order; they do not establish an objectively best name.</p></div> : match ? <section className="ft-choice" aria-label="Current tournament match">
        <div className="ft-choice-heading"><div><span className="eyebrow">{match.label} · {match.id}</span><h3>Voting now: {personLabel[person]}</h3></div><span>{match.votes[person] ? "Your vote is saved" : "You have not voted yet"}</span></div>
        <div className="ft-choice-grid">{[match.a!, match.b!].map(id => { const n = nameMap.get(id)!; return <article key={id} className={match.votes[person] === id ? "ft-picked" : ""}><span className="eyebrow">{bracket.losses[id]} {bracket.losses[id] === 1 ? "LOSS" : "LOSSES"}</span><h3>{n.name}</h3>{appConfig.researchEnabled && <><p><small>BR</small>{n.br}</p><p><small>EN</small>{n.en}</p></>}<button className="primary" disabled={disabled} onClick={() => act({ action: "vote", matchId: match.id, person, winnerId: id })}><Heart size={16}/>{match.votes[person] === id ? "My choice" : `Choose ${n.name}`}</button></article>; })}</div>
        <div className="ft-picks">{(["first", "second"] as Person[]).map(p => <p key={p}><strong>{personLabel[p]}</strong><span>{match.votes[p] ? p === person || match.votes[person] ? getName(match.votes[p]) : "Vote saved" : "Still choosing"}</span></p>)}</div>
        {match.votes.first && match.votes.second && match.votes.first !== match.votes.second ? <div className="ft-discuss"><strong>Your choices differ — discuss this pair</strong><p>You can change your vote above. If you agree after discussing, confirm your joint decision:</p><div>{[match.a!, match.b!].map(id => <button key={id} className="secondary" disabled={disabled} onClick={() => setConfirmation({action:"decide",matchId:match.id,winnerId:id})}>Together, choose {getName(id)}</button>)}</div></div> : <p className="ft-small">Matching votes complete the match automatically. The other vote stays hidden until you vote. A tie does not advance a name; you can return later.</p>}
        {readyMatches.length > 1 && <button className="text-button ft-next" onClick={nextMatch}>Another available pair <ArrowRight size={15}/></button>}
      </section> : <p className="ft-info">Waiting for earlier matches to finish.</p>}

      <section className="ft-match-browser" aria-label="Tournament bracket filters"><div><h3>Find a match or entrant</h3><p>Filters affect the bracket and loss list. The current pair above stays available.</p></div><div className="ft-match-filters">
        <label>Name or match number<input aria-label="Search tournament bracket" value={matchQuery} onChange={e=>setMatchQuery(e.target.value)} placeholder="For example, Alex or W1…"/></label>
        <label>Match status<select value={matchStatus} onChange={e=>setMatchStatus(e.target.value)}><option value="any">All statuses</option><option value="ready">Ready to vote</option><option value="done">Complete</option><option value="waiting">Waiting for earlier matches</option><option value="bye">Bye</option><option value="inactive">Only if needed</option></select></label>
        <label>Bracket<select value={matchBracket} onChange={e=>setMatchBracket(e.target.value)}><option value="any">All brackets</option><option value="winners">Winners</option><option value="losers">Losers</option><option value="final">Finals</option></select></label>
        <label>My vote<select value={matchOwn} onChange={e=>setMatchOwn(e.target.value)}><option value="any">Any</option><option value="picked">Already voted</option><option value="unpicked">Not voted yet</option></select></label>
        <label>Vote agreement<select value={matchAgreement} onChange={e=>setMatchAgreement(e.target.value)}><option value="any">Any</option><option value="agreed">Matching votes</option><option value="different">Different votes</option><option value="pending">Waiting for votes</option><option value="joint">Joint decision after discussion</option></select></label>
        <label>Entrant losses<select value={lossFilter} onChange={e=>setLossFilter(e.target.value)}><option value="any">Any number</option><option value="0">0 · unbeaten</option><option value="1">1 · second chance</option><option value="2">2 · eliminated</option></select></label>
      </div><div className="ft-filter-count"><span>{visibleMatches.length} of {bracket.matches.length} matches · {visibleLossIds.length} of {tournament.nameIds.length} entrants</span><button className="text-button" onClick={resetMatchFilters}>Reset bracket filters</button></div></section>
      <div className="ft-losses" aria-label="Losses by entrant">{visibleLossIds.map(id => <span key={id} className={bracket.losses[id] >= 2 ? "ft-eliminated" : ""}>{getName(id)} <b>{bracket.losses[id]} / 2</b></span>)}</div>
      {!visibleMatches.length&&<p className="ft-info">No matches meet these conditions. Reset bracket filters; your results remain saved.</p>}
      <div className="ft-brackets">{(["winners", "losers", "final"] as const).map(kind => {
        const shown=visibleMatches.filter(m=>m.bracket===kind);if(!shown.length)return null;
        return <section key={kind}><div className="ft-bracket-heading"><h3>{kind === "winners" ? "Winners bracket" : kind === "losers" ? "Losers bracket" : "Finals"}</h3><p>{kind === "winners" ? "The first loss sends an entrant to the losers bracket." : kind === "losers" ? "The second loss eliminates an entrant." : "If the losers finalist wins, one more deciding match is required."}</p></div><div className="ft-rounds">{[...new Set(shown.map(m=>m.round))].map(round => <div className="ft-round" key={round}><h4>{kind === "final" ? round === 1 ? "Grand final" : "Reset final" : `Round ${round}`}</h4>{shown.filter(m=>m.round===round).map(renderMatchCard)}</div>)}{kind === "losers" && tournament.nameIds.length === 2 && <p className="ft-small">With two names, the first-match loser goes directly to the grand final.</p>}</div></section>
      })}</div>
    </>}

    {(!tournament || configOpen) && <section className="ft-config" aria-label="Tournament setup"><div><p className="eyebrow">EDIT ENTRANTS BEFORE STARTING</p><h2>{tournament ? "Create another final" : "Create a final tournament"}</h2><p>Suggest leading names from a league or shared ratings. Review the names, add your own, and arrange the seeds.</p><ul><li>Choose 2–16 names. An entrant is eliminated after two played losses.</li><li>A bye counts as neither a played win nor a loss.</li><li>Seeding affects pairings. Entrants are fixed after the tournament starts.</li><li>Return from any device. Only the latest completed match can be undone.</li></ul></div>
      <div className="ft-config-panel"><label>Suggestion source<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="ratings">Shared ratings</option>{leagues.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label><div className="ft-suggestion-controls"><label>Number of names<select value={seedCount} onChange={e => setSeedCount(Number(e.target.value))}>{Array.from({ length: 15 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}</select></label><button className="secondary" disabled={disabled} onClick={() => { setSeedIds([...suggestions.nameIds]); setAppliedSource({ label: suggestions.label+" · using current filters", edited: false, provisional: suggestions.provisional }); setAdding(""); }}>Suggest entrants</button></div><p className="ft-small">Next suggestion: {suggestions.label} · {candidateIds.length} names match the filters. {sourceId !== "ratings" ? suggestions.hasVotes ? suggestions.provisional ? "The league is unfinished, so this suggestion is provisional." : "All league comparisons are complete." : "The league has no votes yet; ordering uses shared ratings." : "Names liked by both participants rank first. Unrated names do not count as approved."} Set-aside names and vetoes are excluded. Click “Suggest entrants” to update the roster below.</p>
      <div className="ft-candidate-browser"><NameFilterPanel value={candidateFilters} onChange={setCandidateFilters} context={candidateContext} ids={eligibleNames.map(n=>n.id)} title="Names to consider for the final" compact/><SavedNameViews scope="tournament" value={candidateFilters} onChange={setCandidateFilters} disabled={!ready}/><p className="ft-small">Filters apply when suggesting or adding entrants. They do not change the roster automatically. Set-aside and vetoed names cannot enter a new tournament.</p><div className="ft-candidate-actions"><span>Found {candidateNames.length} · entrants {seedIds.length} / 16</span><button className="secondary" disabled={disabled||!candidateAvailable.length||seedIds.length>=16} onClick={()=>changeSeeds(candidateAvailable.map(n=>n.id),true)}>Add matching names ({Math.min(candidateAvailable.length,16-seedIds.length)})</button><button className="text-button" disabled={disabled||!candidateNames.some(n=>seedIds.includes(n.id))} onClick={()=>changeSeeds(candidateNames.map(n=>n.id),false)}>Remove matching entrants</button></div><div className="ft-candidate-list">{candidateNames.slice(0,candidateLimit).map(n=><label key={n.id}><input type="checkbox" checked={seedIds.includes(n.id)} disabled={disabled||!seedIds.includes(n.id)&&seedIds.length>=16} onChange={e=>changeSeeds([n.id],e.target.checked)}/><span><b>{n.name}</b>{appConfig.researchEnabled && <small>{n.br}</small>}</span></label>)}</div>{candidateNames.length>candidateLimit&&<button className="text-button" onClick={()=>setCandidateLimit(v=>v+16)}>Show {Math.min(16,candidateNames.length-candidateLimit)} more names</button>}{!candidateNames.length&&<p className="ft-info">No available names match. Remove conditions or reset filters; the seed list will remain.</p>}</div>
      <label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="For example, Our final" maxLength={120}/></label>
      <p className="ft-small"><strong>Current entrants:</strong> {appliedSource.label}{appliedSource.edited ? " · edited manually" : appliedSource.provisional ? " · provisional suggestion" : " · suggestion from a completed league"}.</p>
      <ol className="ft-seed-list">{seedIds.map((id, index) => <li key={id} className={!tournamentEligible(ratings[id]) ? "ft-seed-excluded" : ""}><span className="ft-seed-number">{index + 1}</span><strong>{getName(id)}</strong><button aria-label={`Move up: ${getName(id)} in seed order`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button aria-label={`Move down: ${getName(id)} in seed order`} disabled={disabled || index === seedIds.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button aria-label={`Remove ${getName(id)} from entrants`} disabled={disabled} onClick={() => { setSeedIds(old => old.filter(x => x !== id)); setAppliedSource(old => ({ ...old, edited: true })); }}><X size={16}/></button></li>)}</ol>
      <div className="ft-add"><label className="sr-only" htmlFor="ft-add-name">Name to add</label><select id="ft-add-name" value={adding} onChange={e => setAdding(e.target.value)} disabled={disabled || seedIds.length >= 16}><option value="">Add a name…</option>{candidateAvailable.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select><button className="secondary" aria-label="Add selected name" disabled={disabled || !adding || seedIds.length >= 16 || !candidateAvailable.some(n=>n.id===adding)} onClick={() => changeSeeds([adding],true)}><Plus size={17}/></button></div>
      {excludedSeeds.length > 0 && <p className="ft-error-text">Currently set aside or vetoed: {excludedSeeds.map(getName).join(", ")}. Remove these entrants or revise their ratings.</p>}
      <p className="ft-small">{seedIds.length} names · from {Math.max(0, seedIds.length * 2 - 2)} to {Math.max(0, seedIds.length * 2 - 1)} played matches with at least two entrants.</p><button className="primary ft-create" disabled={disabled || !loaded || seedIds.length < 2 || seedIds.length > 16 || excludedSeeds.length > 0} onClick={create}>Start tournament <ArrowRight size={17}/></button></div>
    </section>}
    <p className="ft-footnote">The tournament preserves name ratings, league results, and vetoes. The final decision remains yours.</p>
  </section>;
}
