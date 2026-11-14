import type { Tournament } from "./tournament";

export type TournamentRow = { id: string; title: string; pool_json: string; results_json: string; votes_json: string; revision: number; created_at: string; updated_at: string };
export const tournamentColumns = "id, title, pool_json, results_json, votes_json, revision, created_at, updated_at";
export const parseTournament = (row: TournamentRow): Tournament => ({ id: row.id, title: row.title, nameIds: JSON.parse(row.pool_json), results: JSON.parse(row.results_json), votes: JSON.parse(row.votes_json), revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at });

export async function createTournamentOnce(db: D1Database, tournament: Tournament, userId: string): Promise<Tournament | null> {
  await db.prepare("INSERT INTO tournaments (id, title, pool_json, results_json, votes_json, revision, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(tournament.id, tournament.title, JSON.stringify(tournament.nameIds), "[]", "{}", 0, tournament.createdAt, tournament.updatedAt, userId).run();
  const row = await db.prepare(`SELECT ${tournamentColumns} FROM tournaments WHERE id = ?`).bind(tournament.id).first<TournamentRow>();
  if (!row) throw new Error("Tournament did not persist.");
  const saved = parseTournament(row);
  return saved.title === tournament.title && JSON.stringify(saved.nameIds) === JSON.stringify(tournament.nameIds) ? saved : null;
}

export async function writeTournamentRevision(db: D1Database, next: Tournament, previousRevision: number, userId: string): Promise<boolean> {
  const response = await db.prepare("UPDATE tournaments SET results_json = ?, votes_json = ?, revision = ?, updated_at = ?, updated_by = ? WHERE id = ? AND revision = ?")
    .bind(JSON.stringify(next.results), JSON.stringify(next.votes), next.revision, next.updatedAt, userId, next.id, previousRevision).run();
  return response.meta.changes === 1;
}
