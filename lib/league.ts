import type { Choice, League, Pair, Person, Vote } from "./types";

/** Canonical keys make a reverse-side replay update the same match. */
export function normalizeVote<T extends Pair & { choice: Choice }>(vote: T): T {
  if (vote.a === vote.b) throw new Error("A name cannot play itself.");
  if (vote.a < vote.b) return { ...vote };
  return { ...vote, a: vote.b, b: vote.a, choice: vote.choice === "tie" ? "tie" : vote.choice === "a" ? "b" : "a" };
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Circle schedule spreads names across rounds; every unordered pair appears once. */
export function allPairs(nameIds: string[]): Pair[] {
  const ids: (string | null)[] = [...new Set(nameIds)].sort();
  if (ids.length < 2) return [];
  if (ids.length % 2) ids.push(null);
  const result: Pair[] = [];
  for (let round = 0; round < ids.length - 1; round++) {
    for (let index = 0; index < ids.length / 2; index++) {
      const a = ids[index], b = ids[ids.length - index - 1];
      if (a !== null && b !== null) result.push(a < b ? { a, b } : { a: b, b: a });
    }
    ids.splice(1, 0, ids.pop()!);
  }
  return result;
}

function validVotes(nameIds: string[], votes: Vote[], person?: Person): Vote[] {
  const pool = new Set(nameIds);
  const newest = new Map<string, Vote>();
  for (const input of votes) {
    if (person && input.person !== person) continue;
    if (!pool.has(input.a) || !pool.has(input.b) || input.a === input.b) continue;
    const vote = normalizeVote(input);
    const key = `${vote.leagueId}:${vote.person}:${pairKey(vote.a, vote.b)}`;
    const old = newest.get(key);
    if (!old || vote.updatedAt >= old.updatedAt) newest.set(key, vote);
  }
  return [...newest.values()];
}

export type Standing = {
  nameId: string; played: number; wins: number; draws: number; losses: number;
  points: number; possible: number; pointsRate: number | null; rank: number;
};

/** Pass votes from one league. Combined rows include each partner's separate match. */
export function standings(nameIds: string[], votes: Vote[], person?: Person): Standing[] {
  const ids = [...new Set(nameIds)];
  const rows = new Map(ids.map(nameId => [nameId, { nameId, played: 0, wins: 0, draws: 0, losses: 0, points: 0, possible: (ids.length - 1) * (person ? 1 : 2), pointsRate: null, rank: 0 } as Standing]));
  for (const vote of validVotes(ids, votes, person)) {
    const a = rows.get(vote.a)!, b = rows.get(vote.b)!;
    a.played++; b.played++;
    if (vote.choice === "tie") { a.draws++; b.draws++; a.points++; b.points++; }
    else {
      const winner = vote.choice === "a" ? a : b;
      const loser = vote.choice === "a" ? b : a;
      winner.wins++; winner.points += 3; loser.losses++;
    }
  }
  const values = [...rows.values()];
  values.forEach(row => { row.pointsRate = row.played ? row.points / (3 * row.played) : null; });
  const complete = values.every(row => row.played === row.possible);
  const sorted = values.sort((a, b) => complete
    ? b.points - a.points || b.wins - a.wins || a.nameId.localeCompare(b.nameId)
    : (b.pointsRate ?? -1) - (a.pointsRate ?? -1) || b.played - a.played || a.nameId.localeCompare(b.nameId));
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    const tied = previous && (complete
      ? previous.points === row.points && previous.wins === row.wins
      : previous.pointsRate === row.pointsRate);
    row.rank = tied ? previous.rank : index + 1;
  });
  return sorted;
}

export function leagueProgress(league: League, votes: Vote[]) {
  const all = validVotes(league.nameIds, votes.filter(v => v.leagueId === league.id));
  const total = league.nameIds.length * (league.nameIds.length - 1) / 2;
  const first = all.filter(v => v.person === "first").length;
  const second = all.filter(v => v.person === "second").length;
  return { total, first, second, complete: first === total && second === total };
}

/** Worst partner's observed preference fraction; null until both have compared it. */
export function consensusStandings(nameIds: string[], votes: Vote[]) {
  const first = new Map(standings(nameIds, votes, "first").map(r => [r.nameId, r]));
  const second = new Map(standings(nameIds, votes, "second").map(r => [r.nameId, r]));
  const sorted = standings(nameIds, votes).map(row => {
    const h = first.get(row.nameId)!, w = second.get(row.nameId)!;
    const fraction = (r: Standing) => r.played ? (r.wins + r.draws * 0.5) / r.played : null;
    const hf = fraction(h), wf = fraction(w);
    return { ...row, first: h, second: w, consensus: hf === null || wf === null ? null : Math.min(hf, wf), complete: h.played === nameIds.length - 1 && w.played === nameIds.length - 1 };
  }).sort((a, b) => (b.consensus ?? -1) - (a.consensus ?? -1) || b.points - a.points || a.nameId.localeCompare(b.nameId));
  sorted.forEach((row, index) => { row.rank = index > 0 && sorted[index - 1].consensus === row.consensus ? sorted[index - 1].rank : index + 1; });
  return sorted;
}

/** A strict pairwise winner must have a completed win against every opponent. */
export function condorcetWinner(nameIds: string[], votes: Vote[], person?: Person): string | null {
  if (nameIds.length < 2) return null;
  const valid = validVotes(nameIds, votes, person);
  const results = new Map<string, Vote[]>();
  valid.forEach(v => { const key = pairKey(v.a, v.b); results.set(key, [...(results.get(key) ?? []), v]); });
  for (const id of nameIds) {
    const winsEvery = nameIds.filter(other => other !== id).every(other => {
      const pair = results.get(pairKey(id, other)) ?? [];
      if (pair.length !== (person ? 1 : 2)) return false;
      let score = 0;
      for (const v of pair) { if (v.choice !== "tie") score += (v.choice === "a" ? v.a : v.b) === id ? 1 : -1; }
      return score > 0;
    });
    if (winsEvery) return id;
  }
  return null;
}
