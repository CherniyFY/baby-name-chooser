import { ApiError, authorize, body, json, route, validPerson } from "@/lib/server";
import { applyTournamentAction, TournamentError, type TournamentAction } from "@/lib/tournament";
import { parseTournament, tournamentColumns, writeTournamentRevision, type TournamentRow } from "@/lib/tournament-store";

export const POST = route(async request => {
  const { db, user } = await authorize(request, true), data = await body(request);
  const id = new URL(request.url).pathname.split("/").at(-1) ?? "";
  const row = await db.prepare(`SELECT ${tournamentColumns} FROM tournaments WHERE id = ?`).bind(id).first<TournamentRow>();
  if (!row) throw new ApiError(404, "Tournament not found.");
  if (!Number.isSafeInteger(data.revision) || data.revision !== row.revision) throw new ApiError(409, "This tournament changed on another device. Review the latest version and repeat your choice.");
  if (typeof data.matchId !== "string" || data.matchId.length > 30) throw new ApiError(400, "Unknown match.");
  let action: TournamentAction;
  if (data.action === "undo") action = { action: "undo", matchId: data.matchId };
  else if ((data.action === "vote" || data.action === "decide") && typeof data.winnerId === "string") action = data.action === "vote"
    ? { action: "vote", matchId: data.matchId, winnerId: data.winnerId, person: validPerson(data.person) }
    : { action: "decide", matchId: data.matchId, winnerId: data.winnerId };
  else throw new ApiError(400, "Unknown action.");
  try {
    const next = applyTournamentAction(parseTournament(row), action, new Date().toISOString());
    if (!await writeTournamentRevision(db, next, row.revision, user.userId)) throw new ApiError(409, "This tournament changed on another device. Refresh and repeat your choice.");
    return json({ tournament: next });
  } catch (error) {
    if (error instanceof TournamentError) throw new ApiError(400, error.message);
    throw error;
  }
});
