import type { League } from "./types";

export class LeagueRequestConflict extends Error {}

/** A retried request must return its original league, even if the first response was lost. */
export async function createLeagueOnce(db: D1Database, league: League, createdBy: string): Promise<League> {
  const nameIds = JSON.stringify(league.nameIds);
  await db.prepare("INSERT INTO leagues (id, title, name_ids, created_at, created_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(league.id, league.title, nameIds, league.createdAt, createdBy).run();
  const saved = await db.prepare("SELECT id, title, name_ids, created_at FROM leagues WHERE id = ?")
    .bind(league.id).first<{ id: string; title: string; name_ids: string; created_at: string }>();
  if (!saved) throw new Error("League insert did not persist.");
  if (saved.title !== league.title || saved.name_ids !== nameIds) throw new LeagueRequestConflict("Request id already belongs to a different league.");
  return { id: saved.id, title: saved.title, nameIds: JSON.parse(saved.name_ids), createdAt: saved.created_at };
}
