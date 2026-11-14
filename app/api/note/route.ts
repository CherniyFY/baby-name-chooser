import { ApiError, authorize, body, json, route, validName } from "@/lib/server";

export const POST = route(async request => {
  const { db, user } = await authorize(request, true);
  const data = await body(request), name = validName(data.nameId);
  if (typeof data.text !== "string" || data.text.length > 4000) throw new ApiError(400, "A note may contain at most 4,000 characters.");
  const updatedAt = new Date().toISOString();
  await db.prepare("INSERT INTO notes (name_id, text, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(name_id) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at, updated_by=excluded.updated_by").bind(name, data.text, updatedAt, user.userId).run();
  return json({ ok: true, updatedAt });
});
