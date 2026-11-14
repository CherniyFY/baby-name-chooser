import { ApiError, authorize, body, json, route, validName } from "@/lib/server";
import { createTournamentOnce, parseTournament, tournamentColumns, type TournamentRow } from "@/lib/tournament-store";
import { getBracket, type Tournament } from "@/lib/tournament";
import { names } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const GET = route(async request => {
  const { db } = await authorize(request);
  const rows = await db.prepare(`SELECT ${tournamentColumns} FROM tournaments ORDER BY created_at DESC, id DESC LIMIT 50`).all<TournamentRow>();
  const knownIds = new Set(names.map(name => name.id));
  return json({ tournaments: rows.results.map(parseTournament).filter(tournament => tournament.nameIds.every(id => knownIds.has(id))) });
});

export const POST = route(async request => {
  const { db, user } = await authorize(request, true), data = await body(request);
  if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestId)) throw new ApiError(400, "Invalid request. Refresh the page.");
  if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 120) throw new ApiError(400, "A title must contain 1–120 characters.");
  if (!Array.isArray(data.nameIds) || data.nameIds.length < 2 || data.nameIds.length > 16) throw new ApiError(400, "Choose 2–16 names.");
  const nameIds = data.nameIds.map(validName);
  if (new Set(nameIds).size !== nameIds.length) throw new ApiError(400, "Roster names must be unique.");
  const id = data.requestId.toLowerCase();
  // Replays must still succeed if family ratings changed after the initial save.
  const existing = await db.prepare(`SELECT ${tournamentColumns} FROM tournaments WHERE id = ?`).bind(id).first<TournamentRow>();
  if (existing) {
    const saved = parseTournament(existing);
    if (saved.title !== data.title.trim() || JSON.stringify(saved.nameIds) !== JSON.stringify(nameIds)) throw new ApiError(409, "This request already created a tournament with a different roster.");
    return json({ tournament: saved });
  }
  const ratings: Record<string, Record<string, string>> = Object.fromEntries(names.map(n => [n.id, { ...n.initialRatings }]));
  const savedRatings = await db.prepare("SELECT name_id, person, value FROM ratings").all<{ name_id: string; person: string; value: string }>();
  for (const r of savedRatings.results) if (ratings[r.name_id]) ratings[r.name_id][r.person] = r.value;
  if (nameIds.some(id => [ratings[id].first, ratings[id].second].some(value => value === "dismissed" || value === "veto"))) throw new ApiError(409, "Some names are deferred or vetoed. Review the ratings or change the roster first.");
  const now = new Date().toISOString();
  const tournament: Tournament = { id, title: data.title.trim(), nameIds, results: [], votes: {}, revision: 0, createdAt: now, updatedAt: now };
  getBracket(tournament);
  const saved = await createTournamentOnce(db, tournament, user.userId);
  if (!saved) throw new ApiError(409, "This request already created a tournament with a different roster.");
  return json({ tournament: saved }, 201);
});
