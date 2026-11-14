import { names } from "@/lib/catalog";
import { buildState, type LeagueRow, type NoteRow, type RatingRow, type VoteRow } from "@/lib/state";
import { authorize, json, route } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = route(async request => {
  const { db } = await authorize(request);
  const [ratings, notes, leagues, votes] = await db.batch([
    db.prepare("SELECT name_id, person, value, updated_at FROM ratings"),
    db.prepare("SELECT name_id, text, updated_at FROM notes"),
    db.prepare("SELECT id, title, name_ids, created_at FROM leagues ORDER BY created_at DESC, id DESC"),
    db.prepare("SELECT league_id, person, a, b, choice, updated_at FROM votes"),
  ]);
  return json(buildState(names, ratings.results as RatingRow[], notes.results as NoteRow[], leagues.results as LeagueRow[], votes.results as VoteRow[]));
});
