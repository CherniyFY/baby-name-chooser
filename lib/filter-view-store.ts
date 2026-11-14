export type FilterViewScope = "names" | "research" | "results" | "tournament";
export type FilterViewContent = { title: string; scope: FilterViewScope; filtersJson: string; sort: string };
export type FilterViewRow = {
  id: string; title: string; scope: FilterViewScope; filters_json: string; sort: string;
  creation_json: string; revision: number; created_at: string; updated_at: string;
};
export const filterViewColumns = "id, title, scope, filters_json, sort, creation_json, revision, created_at, updated_at";

const creationFingerprint = (content: FilterViewContent) => JSON.stringify([content.scope, content.title, content.filtersJson, content.sort]);

/** Replaying a lost create response never creates a second view or restores old filters. */
export async function createFilterViewOnce(db: D1Database, id: string, content: FilterViewContent, userId: string, now: string): Promise<FilterViewRow | null> {
  const fingerprint = creationFingerprint(content);
  await db.prepare("INSERT INTO filter_views (id, title, scope, filters_json, sort, creation_json, revision, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(id, content.title, content.scope, content.filtersJson, content.sort, fingerprint, now, now, userId).run();
  const row = await db.prepare(`SELECT ${filterViewColumns} FROM filter_views WHERE id = ?`).bind(id).first<FilterViewRow>();
  if (!row) throw new Error("Filter view did not persist.");
  return row.creation_json === fingerprint ? row : null;
}

export async function writeFilterViewRevision(db: D1Database, id: string, content: FilterViewContent, expectedRevision: number, userId: string, now: string): Promise<boolean> {
  const result = await db.prepare("UPDATE filter_views SET title = ?, filters_json = ?, sort = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ? AND scope = ? AND revision = ?")
    .bind(content.title, content.filtersJson, content.sort, now, userId, id, content.scope, expectedRevision).run();
  return result.meta.changes === 1;
}

export async function deleteFilterViewRevision(db: D1Database, id: string, scope: FilterViewScope, expectedRevision: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM filter_views WHERE id = ? AND scope = ? AND revision = ?").bind(id, scope, expectedRevision).run();
  return result.meta.changes === 1;
}
