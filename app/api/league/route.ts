import { ApiError, authorize, body, json, route, validName, nameIds as availableNames } from "@/lib/server";
import type { League } from "@/lib/types";
import { createLeagueOnce, LeagueRequestConflict } from "@/lib/create-league";

export const POST = route(async request => {
  const { db, user } = await authorize(request, true);
  const data = await body(request);
  if (!Array.isArray(data.nameIds) || data.nameIds.length < 2 || data.nameIds.length > availableNames.size) throw new ApiError(400, `Choose between 2 and ${availableNames.size} names.`);
  const nameIds = [...new Set(data.nameIds.map(validName))].sort();
  if (nameIds.length < 2) throw new ApiError(400, "Choose at least two different names.");
  if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 120) throw new ApiError(400, "Name this league using at most 120 characters.");
  if (data.requestId !== undefined && (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestId))) throw new ApiError(400, "Invalid request ID. Refresh the page and try again.");
  const league: League = { id: typeof data.requestId === "string" ? data.requestId.toLowerCase() : crypto.randomUUID(), title: data.title.trim(), nameIds, createdAt: new Date().toISOString() };
  try {
    return json({ ok: true, league: await createLeagueOnce(db, league, user.userId) }, 201);
  } catch (error) {
    if (error instanceof LeagueRequestConflict) throw new ApiError(409, "This request already created a league with a different roster. Start again.");
    throw error;
  }
});
