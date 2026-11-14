"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Check, LoaderCircle, RefreshCw, Save, Trash2 } from "lucide-react";
import { normalizeNameFilters } from "../../lib/name-filters";
import type { NameFilters } from "../../lib/name-filters";
import type { FilterViewScope } from "../../lib/filter-view-store";
import "./SavedNameViews.css";

type SavedView = { id: string; title: string; scope: FilterViewScope; filters: NameFilters; sort: string; revision: number; createdAt: string; updatedAt: string };
type Operation = { method: "POST" | "DELETE"; payload: Record<string, unknown>; label: string };
type Props = {
  scope: FilterViewScope;
  value: NameFilters;
  onChange: (filters: NameFilters, sort?: string) => void;
  sort?: string;
  disabled?: boolean;
};
const scopeLabels: Record<FilterViewScope, string> = { names: "Names", research: "Research", results: "Results", tournament: "Final tournament" };

export default function SavedNameViews({ scope, value, onChange, sort = "alphabet", disabled = false }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showAllScopes, setShowAllScopes] = useState(false);
  const [title, setTitle] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Operation | null>(null);
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const busyRef = useRef(false), pendingRef = useRef<Operation | null>(null), requestSequence = useRef(0), saveErrorRef = useRef(false);
  const selected = views.find(v => v.id === selectedId);
  const selectedIsLocal = selected?.scope === scope;
  const blocked = disabled || busy || !!pending;
  const draftKey = JSON.stringify([scope, normalizeNameFilters(value), sort, title, selectedId]);

  const refresh = useCallback(async (clearError = false) => {
    if (disabled || busyRef.current) return;
    const seq = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await fetch(showAllScopes ? "/api/filter-views" : `/api/filter-views?scope=${encodeURIComponent(scope)}`, { cache: "no-store" });
      const data = await response.json() as { views?: SavedView[]; error?: string };
      if (response.status === 401) setAuth(true);
      if (!response.ok || !Array.isArray(data.views)) throw new Error(data.error || "Could not load saved views.");
      if (seq === requestSequence.current) {
        setViews(data.views); setLoaded(true); setAuth(false);
        if (!pendingRef.current && (clearError || !saveErrorRef.current)) { setError(""); saveErrorRef.current = false; }
      }
    } catch (e) {
      if (seq === requestSequence.current && !pendingRef.current) setError(e instanceof Error ? e.message : "Could not connect to shared views.");
    } finally { if (seq === requestSequence.current) setLoading(false); }
  }, [scope, disabled, showAllScopes]);

  useEffect(() => {
    void refresh(true);
    const onFocus = () => void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 20000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); };
  }, [refresh]);
  useEffect(() => { setConfirmation(null); }, [draftKey, selected?.revision]);
  useEffect(() => {
    if (loaded && selectedId && !views.some(v => v.id === selectedId)) {
      setSelectedId(""); setNotice("The selected view was deleted. Your current filters and title remain here.");
    }
  }, [loaded, selectedId, views]);

  async function send(operation: Operation, retry = false) {
    if (disabled || busyRef.current || pendingRef.current && !retry) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice(""); ++requestSequence.current;
    try {
      const response = await fetch("/api/filter-views", { method: operation.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation.payload) });
      const data = await response.json() as { view?: SavedView; deleted?: string; error?: string };
      if (response.status === 401) setAuth(true);
      if (response.status === 409) {
        pendingRef.current = null; setPending(null); setConfirmation(null);
        saveErrorRef.current = true;
        setError(data.error || "This view changed on another device. Check the shared version or save a new copy.");
        busyRef.current = false;
        await refresh();
        return;
      }
      if (!response.ok || operation.method === "POST" && !data.view || operation.method === "DELETE" && !data.deleted) throw new Error(data.error || "View was not saved. Please try again.");
      pendingRef.current = null; setPending(null); setConfirmation(null); setAuth(false); setLoaded(true); saveErrorRef.current = false;
      if (data.view) {
        const view = data.view;
        setViews(old => [view, ...old.filter(v => v.id !== view.id)].sort((a, b) => a.title.localeCompare(b.title, "en")));
        setSelectedId(view.id); setTitle(view.title);
      } else if (data.deleted) {
        setViews(old => old.filter(v => v.id !== data.deleted)); setSelectedId("");
      }
      setNotice(operation.label);
    } catch (e) {
      saveErrorRef.current = true;
      pendingRef.current = operation; setPending(operation);
      setError(e instanceof Error ? e.message : "View was not saved. Your title and filters remain here.");
    } finally { busyRef.current = false; setBusy(false); setLoading(false); }
  }
  function create() {
    if (!title.trim()) return;
    void send({ method: "POST", payload: { requestId: crypto.randomUUID(), title: title.trim(), scope, filters: normalizeNameFilters(value), sort }, label: "New view saved for both participants." });
  }
  function replace() {
    if (!selected || !selectedIsLocal || !title.trim()) return;
    setConfirmation({ method: "POST", payload: { id: selected.id, revision: selected.revision, title: title.trim(), scope, filters: normalizeNameFilters(value), sort }, label: "View updated for both participants." });
  }
  function remove() {
    if (!selected || !selectedIsLocal) return;
    setConfirmation({ method: "DELETE", payload: { id: selected.id, revision: selected.revision, scope }, label: "View deleted. Your current filters remain on screen." });
  }

  return <details className="saved-name-views">
    <summary><Bookmark size={16}/><span>Saved views</span><small>{loaded ? views.length : "…"}</small>{(loading || busy) && <LoaderCircle size={14} className="spin"/>}</summary>
    <p className="sv-help">Save name filters and sort order as a named view. Both participants can open views on any device. Views save criteria, so matching names may change as your ratings change.</p>
    <label className="sv-all-scopes"><input type="checkbox" checked={showAllScopes} disabled={blocked} onChange={e => { ++requestSequence.current; setShowAllScopes(e.target.checked); setConfirmation(null); if (!e.target.checked && selected && !selectedIsLocal) { setSelectedId(""); setNotice(""); } }}/> Views from all sections</label>
    <div className="sv-load-row"><label>Shared view<select aria-label="Saved filter view" value={selectedId} disabled={blocked || !loaded} onChange={e => { const view = views.find(v => v.id === e.target.value); setSelectedId(e.target.value); if (view) setTitle(view.title); setNotice(""); setConfirmation(null); }}><option value="">Choose a view…</option>{views.map(view => <option key={view.id} value={view.id}>{view.title}{showAllScopes ? ` · ${scopeLabels[view.scope]}` : ""}</option>)}</select></label><button className="secondary" disabled={blocked || !selected} onClick={() => { if (selected) { onChange(normalizeNameFilters(selected.filters), selected.sort); setNotice(`Opened view “${selected.title}” from “${scopeLabels[selected.scope]}”.`); } }}>Open</button><button className="sv-icon-button" aria-label="Refresh saved views" disabled={disabled || busy} onClick={() => void refresh(true)}><RefreshCw size={16}/></button></div>
    <div className="sv-save-row"><label>Title<input aria-label="Filter view title" value={title} maxLength={80} disabled={blocked} placeholder="For example, Liked by both" onChange={e => { setTitle(e.target.value); setNotice(""); }}/></label><button className="secondary" disabled={blocked || !loaded || !title.trim()} onClick={create}><Save size={15}/> {selected && !selectedIsLocal ? "Save a new view here" : "Save new view"}</button></div>
    {selected && !selectedIsLocal && <p className="sv-cross-scope">The original view belongs to “{scopeLabels[selected.scope]}”. Open it, adjust the filters if needed, and save a new view in “{scopeLabels[scope]}”. The original view will remain.</p>}
    {selected && <div className="sv-edit-row"><span>Selected: “{selected.title}” · {scopeLabels[selected.scope]}</span><button className="text-button" disabled={blocked || !selectedIsLocal || !title.trim()} onClick={replace}>Replace with current filters</button><button className="text-button sv-delete" disabled={blocked || !selectedIsLocal} onClick={remove}><Trash2 size={14}/> Delete</button></div>}
    {confirmation && <div className="sv-confirm" role="group" aria-label="Confirm view change"><strong>{confirmation.method === "DELETE" ? `Delete the shared view “${selected?.title || ""}”?` : `Replace the shared view “${selected?.title || ""}” with the filters on screen${title.trim() !== selected?.title ? ` and rename it to “${title.trim()}”` : ""}?`}</strong><p>{confirmation.method === "DELETE" ? "This saved view will be deleted for both participants. Names, ratings, and the filters on screen will remain." : "Both participants will see the updated view. Name ratings and existing league rosters will remain."}</p><button className="secondary" disabled={blocked} onClick={() => void send(confirmation)}>{confirmation.method === "DELETE" ? "Delete view" : "Confirm replacement"}</button><button className="text-button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div>}
    {error && <div className="sv-error" role="alert"><p>{error}</p>{auth ? <a href="/" target="_top">Reload and sign in</a> : <button className="text-button" disabled={disabled || busy} onClick={() => pending ? void send(pending, true) : void refresh(true)}>{pending ? "Retry saving" : "Refresh views"}</button>}{pending && <button className="text-button" disabled={busy} onClick={() => { pendingRef.current = null; setPending(null); setError(""); void refresh(true); }}>Discard retry and load shared views</button>}</div>}
    {notice && <p className="sv-notice" role="status"><Check size={15}/>{notice}</p>}
  </details>;
}
