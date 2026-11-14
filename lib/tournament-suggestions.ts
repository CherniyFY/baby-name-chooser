import { consensusStandings, leagueProgress, standings } from "./league";
import type { League, Person, Rating, Vote } from "./types";

export function tournamentEligible(ratings: Record<Person, Rating> | undefined): boolean {
  return !ratings || ![ratings.first, ratings.second].some(r => r === "dismissed" || r === "veto");
}

export function suggestTournamentSeeds(
  ids: string[], ratings: Record<string, Record<Person, Rating>>, leagues: League[], votes: Vote[], sourceId: string, count: number,
) {
  const weights: Record<Rating, number> = { love: 3, like: 2, maybe: 1, neutral: 0, dismissed: -2, veto: -5 };
  const family = (id: string) => { const r = ratings[id] ?? { first: "neutral", second: "neutral" }; return [Math.min(weights[r.first], weights[r.second]), weights[r.first] + weights[r.second]]; };
  const familyOrder = (a: string, b: string) => { const av = family(a), bv = family(b); return bv[0] - av[0] || bv[1] - av[1] || a.localeCompare(b); };
  const league = leagues.find(l => l.id === sourceId);
  if (league) {
    const leagueVotes = votes.filter(v => v.leagueId === league.id), progress = leagueProgress(league, leagueVotes);
    const consensus = new Map(consensusStandings(league.nameIds, leagueVotes).map(r => [r.nameId, r.consensus]));
    const points = new Map(standings(league.nameIds, leagueVotes).map(r => [r.nameId, r.pointsRate]));
    const eligible = league.nameIds.filter(id => ids.includes(id) && tournamentEligible(ratings[id]));
    eligible.sort((a, b) => (consensus.get(b) ?? -1) - (consensus.get(a) ?? -1) || (points.get(b) ?? -1) - (points.get(a) ?? -1) || familyOrder(a, b));
    return { nameIds: eligible.slice(0, count), label: `Leaders of league “${league.title}”`, provisional: !progress.complete, eligibleCount: eligible.length, hasVotes: leagueVotes.length > 0 };
  }
  const eligible = ids.filter(id => tournamentEligible(ratings[id])).sort(familyOrder);
  return { nameIds: eligible.slice(0, count), label: "From your shared ratings", provisional: true, eligibleCount: eligible.length, hasVotes: false };
}
