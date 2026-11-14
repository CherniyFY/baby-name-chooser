import type { League, Person, Rating, SharedState, Vote } from "./types";

export type RatingRow = { name_id: string; person: Person; value: Rating; updated_at: string };
export type NoteRow = { name_id: string; text: string; updated_at: string };
export type LeagueRow = { id: string; title: string; name_ids: string; created_at: string };
export type VoteRow = { league_id: string; person: Person; a: string; b: string; choice: Vote["choice"]; updated_at: string };
export type SeedName = { id: string; initialRatings: { first: string; second: string } };

export function buildState(seed: SeedName[], ratingRows: RatingRow[], noteRows: NoteRow[], leagueRows: LeagueRow[], voteRows: VoteRow[]): SharedState {
  const knownIds = new Set(seed.map(n => n.id));
  const ratings: SharedState["ratings"] = Object.fromEntries(seed.map(n => [n.id, { first: n.initialRatings.first as Rating, second: n.initialRatings.second as Rating }]));
  for (const row of ratingRows) {
    if (ratings[row.name_id] && (row.person === "second" || row.person === "first")) ratings[row.name_id][row.person] = row.value;
  }
  const notes = Object.fromEntries(noteRows.filter(row => knownIds.has(row.name_id)).map(row => [row.name_id, row.text]));
  // A preset change must never shorten a frozen roster or load unknown entrants.
  // Incompatible records stay in the database and reappear with their catalog.
  const leagues: League[] = leagueRows.map(row => ({ id: row.id, title: row.title, nameIds: JSON.parse(row.name_ids), createdAt: row.created_at }))
    .filter(league => Array.isArray(league.nameIds) && league.nameIds.every((id: string) => knownIds.has(id)));
  const leagueIds = new Set(leagues.map(league => league.id));
  const votes: Vote[] = voteRows.filter(row => leagueIds.has(row.league_id) && knownIds.has(row.a) && knownIds.has(row.b))
    .map(row => ({ leagueId: row.league_id, person: row.person, a: row.a, b: row.b, choice: row.choice, updatedAt: row.updated_at }));
  const dates = [...ratingRows.map(r => r.updated_at), ...noteRows.map(r => r.updated_at), ...leagueRows.map(r => r.created_at), ...voteRows.map(r => r.updated_at)];
  return { ratings, notes, leagues, votes, updatedAt: dates.sort().at(-1) ?? "" };
}
