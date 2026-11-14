import { ApiError, authorize, body, json, route } from "@/lib/server";
import { normalizeNameFilters } from "@/lib/name-filters";
import { createFilterViewOnce, deleteFilterViewRevision, filterViewColumns, writeFilterViewRevision } from "@/lib/filter-view-store";
import type { FilterViewContent, FilterViewRow, FilterViewScope } from "@/lib/filter-view-store";

export const dynamic = "force-dynamic";
const scopes = new Set<FilterViewScope>(["names", "research", "results", "tournament"]);
function validScope(value: unknown): FilterViewScope {
  if (typeof value !== "string" || !scopes.has(value as FilterViewScope)) throw new ApiError(400, "Unknown saved-view section.");
  return value as FilterViewScope;
}
function validId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, "Invalid saved-view ID.");
  return value;
}
function validRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new ApiError(400, "Refresh the saved views.");
  return value;
}
function content(data: Record<string, unknown>): FilterViewContent {
  if (typeof data.title !== "string" || !data.title.trim() || data.title.trim().length > 80) throw new ApiError(400, "A title must contain 1–80 characters.");
  if (!data.filters || typeof data.filters !== "object" || Array.isArray(data.filters)) throw new ApiError(400, "Provide view filters.");
  if (data.sort !== undefined && (typeof data.sort !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(data.sort))) throw new ApiError(400, "Unknown name order.");
  return { title: data.title.trim(), scope: validScope(data.scope), filtersJson: JSON.stringify(normalizeNameFilters(data.filters)), sort: typeof data.sort === "string" ? data.sort : "alphabet" };
}
function serialize(row: FilterViewRow) {
  return { id: row.id, title: row.title, scope: row.scope, filters: normalizeNameFilters(JSON.parse(row.filters_json)), sort: row.sort, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at };
}
export const GET = route(async request => {
  const { db } = await authorize(request);
  const scope = new URL(request.url).searchParams.get("scope");
  const result = scope === null
    ? await db.prepare(`SELECT ${filterViewColumns} FROM filter_views ORDER BY title COLLATE NOCASE, id`).all<FilterViewRow>()
    : await db.prepare(`SELECT ${filterViewColumns} FROM filter_views WHERE scope = ? ORDER BY title COLLATE NOCASE, id`).bind(validScope(scope)).all<FilterViewRow>();
  return json({ views: result.results.map(serialize) });
});
export const POST = route(async request => {
  const { db, user } = await authorize(request, true);
  const data = await body(request), input = content(data), now = new Date().toISOString();
  if (data.id === undefined) {
    const row = await createFilterViewOnce(db, validId(data.requestId), input, user.userId, now);
    if (!row) throw new ApiError(409, "This request already created a different view. Save a new copy.");
    return json({ view: serialize(row) });
  }
  const id = validId(data.id);
  if (!await writeFilterViewRevision(db, id, input, validRevision(data.revision), user.userId, now)) throw new ApiError(409, "This view changed on another device. Review the latest version or save your filters under a new title.");
  const row = await db.prepare(`SELECT ${filterViewColumns} FROM filter_views WHERE id = ?`).bind(id).first<FilterViewRow>();
  if (!row) throw new ApiError(409, "This view was deleted on another device. Save a new copy.");
  return json({ view: serialize(row) });
});
export const DELETE = route(async request => {
  const { db } = await authorize(request, true), data = await body(request);
  const id = validId(data.id), scope = validScope(data.scope), revision = validRevision(data.revision);
  if (!await deleteFilterViewRevision(db, id, scope, revision)) {
    const row = await db.prepare("SELECT id FROM filter_views WHERE id = ?").bind(id).first();
    if (row) throw new ApiError(409, "This view changed on another device. Review its latest version before deleting.");
  }
  return json({ deleted: id });
});
