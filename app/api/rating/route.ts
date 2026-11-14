import { authorize, body, json, route, validName, validPerson, validRating } from "@/lib/server";

export const POST = route(async request => {
  const { db, user } = await authorize(request, true);
  const data = await body(request);
  const name = validName(data.nameId), person = validPerson(data.person), value = validRating(data.value);
  const updatedAt = new Date().toISOString();
  await db.prepare("INSERT INTO ratings (name_id, person, value, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name_id, person) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by").bind(name, person, value, updatedAt, user.userId).run();
  return json({ ok: true, updatedAt });
});
