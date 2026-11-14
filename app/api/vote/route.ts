import { ApiError, authorize, body, json, route, validName, validPerson } from "@/lib/server";
import { normalizeVote } from "@/lib/league";
import type { Choice, Vote } from "@/lib/types";

async function voteInput(request: Request) {
  const auth = await authorize(request, true), data = await body(request);
  const person = validPerson(data.person), a = validName(data.a), b = validName(data.b);
  if (a === b) throw new ApiError(400, "A name cannot be compared with itself.");
  if (typeof data.leagueId !== "string" || data.leagueId.length > 80) throw new ApiError(400, "Unknown league.");
  const league = await auth.db.prepare("SELECT name_ids FROM leagues WHERE id = ?").bind(data.leagueId).first<{ name_ids: string }>();
  if (!league) throw new ApiError(404, "League not found.");
  const pool: string[] = JSON.parse(league.name_ids);
  if (!pool.includes(a) || !pool.includes(b)) throw new ApiError(400, "Both names must belong to this league.");
  return { ...auth, data, person, a, b, leagueId: data.leagueId };
}

export const POST = route(async request => {
  const { db, user, data, person, a, b, leagueId } = await voteInput(request);
  if (data.choice !== "a" && data.choice !== "b" && data.choice !== "tie") throw new ApiError(400, "Choose a name or a tie.");
  const vote: Vote = normalizeVote({ leagueId, person, a, b, choice: data.choice as Choice, updatedAt: new Date().toISOString() });
  await db.prepare("INSERT INTO votes (league_id, person, a, b, choice, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(league_id, person, a, b) DO UPDATE SET choice=excluded.choice, updated_at=excluded.updated_at, updated_by=excluded.updated_by").bind(vote.leagueId, vote.person, vote.a, vote.b, vote.choice, vote.updatedAt, user.userId).run();
  return json({ ok: true, vote });
});

export const DELETE = route(async request => {
  const { db, person, a, b, leagueId } = await voteInput(request);
  const pair = a < b ? { a, b } : { a: b, b: a };
  await db.prepare("DELETE FROM votes WHERE league_id = ? AND person = ? AND a = ? AND b = ?").bind(leagueId, person, pair.a, pair.b).run();
  return json({ ok: true });
});
