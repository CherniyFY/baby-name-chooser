import assert from "node:assert/strict";
import test from "node:test";
import { allPairs, normalizeVote, pairKey, standings, leagueProgress, consensusStandings, condorcetWinner } from "../lib/league.ts";
import { buildState } from "../lib/state.ts";

const time = "2026-11-02T12:00:00.000Z";
const vote = (a, b, choice, person = "first", updatedAt = time) => ({ leagueId: "league", a, b, choice, person, updatedAt });

test("circle schedule covers every unordered pair exactly once for even and odd pools", () => {
  for (const n of [0, 1, 2, 3, 4, 10, 119, 248]) {
    const ids = Array.from({ length: n }, (_, i) => `N${i}`);
    const pairs = allPairs(ids);
    assert.equal(pairs.length, Math.max(0, n * (n - 1) / 2));
    assert.equal(new Set(pairs.map(p => pairKey(p.a, p.b))).size, pairs.length);
    for (const id of ids) assert.equal(pairs.filter(p => p.a === id || p.b === id).length, n - 1);
    assert.deepEqual(allPairs([...ids].reverse()), pairs);
  }
  assert.deepEqual(allPairs(["a", "a", "b"]), [{ a: "a", b: "b" }]);
});

test("reversing the displayed sides preserves the same winner and canonical pair", () => {
  assert.deepEqual(normalizeVote(vote("b", "a", "a")), vote("a", "b", "b"));
  assert.deepEqual(normalizeVote(vote("b", "a", "b")), vote("a", "b", "a"));
  assert.equal(normalizeVote(vote("b", "a", "tie")).choice, "tie");
  assert.throws(() => normalizeVote(vote("a", "a", "tie")));
});

test("standings use 3/1/0, honor independent partners, and replace replayed votes", () => {
  const votes = [vote("a", "b", "b"), vote("b", "a", "b", "first", "2026-11-02T13:00:00.000Z"), vote("a", "c", "tie"), vote("a", "b", "b", "second")];
  const rows = new Map(standings(["a", "b", "c"], votes).map(r => [r.nameId, r]));
  assert.deepEqual({ points: rows.get("a").points, wins: rows.get("a").wins, draws: rows.get("a").draws, losses: rows.get("a").losses }, { points: 4, wins: 1, draws: 1, losses: 1 });
  assert.equal(rows.get("a").played, 3);
  assert.equal(rows.get("b").points, 3);
  const h = standings(["a", "b", "c"], votes, "first").find(r => r.nameId === "a");
  assert.equal(h.points, 4);
  assert.equal(h.played, 2);
});

test("unplayed names have no rate and incomplete observations never produce a Condorcet claim", () => {
  const rows = standings(["a", "b", "c"], [vote("a", "b", "a")], "first");
  assert.equal(rows.find(r => r.nameId === "c").pointsRate, null);
  assert.equal(condorcetWinner(["a", "b", "c"], [vote("a", "b", "a")], "first"), null);
  assert.equal(consensusStandings(["a", "b"], [vote("a", "b", "a")])[0].consensus, null);
});

test("provisional standings compare points per played match, with tied rates sharing ranks", () => {
  const votes = [vote("a", "b", "a"), vote("a", "c", "tie"), vote("a", "d", "tie"), vote("b", "d", "b")];
  const rows = standings(["a", "b", "c", "d", "e"], votes, "first");
  assert.equal(rows[0].nameId, "d");
  assert.equal(rows[0].points, 4);
  assert.equal(rows[1].nameId, "a");
  assert.equal(rows[1].points, 5);
  assert.ok(rows[0].pointsRate > rows[1].pointsRate);
  const tied = standings(["a", "b", "c"], [vote("a", "b", "tie")], "first");
  assert.equal(tied.find(r => r.nameId === "a").rank, tied.find(r => r.nameId === "b").rank);
});

test("exhaustive league can have a strict winner, a cycle, or no joint winner", () => {
  const cycle = [vote("a", "b", "a"), vote("b", "c", "a"), vote("a", "c", "b")];
  assert.equal(condorcetWinner(["a", "b", "c"], cycle, "first"), null);
  const winner = [vote("a", "b", "a"), vote("a", "c", "a"), vote("b", "c", "tie")];
  assert.equal(condorcetWinner(["a", "b", "c"], winner, "first"), "a");
  assert.equal(condorcetWinner(["a", "b"], [vote("a", "b", "a"), vote("a", "b", "b", "second")]), null);
});

test("both partners need every comparison for league completion", () => {
  const league = { id: "league", nameIds: ["a", "b", "c"] };
  const h = allPairs(league.nameIds).map(p => vote(p.a, p.b, "tie"));
  assert.deepEqual(leagueProgress(league, h), { total: 3, first: 3, second: 0, complete: false });
  const all = [...h, ...h.map(v => ({ ...v, person: "second" }))];
  assert.equal(leagueProgress(league, all).complete, true);
  assert.equal(leagueProgress(league, [...all, vote("a", "b", "a", "first", "2026-11-03T00:00:00.000Z")]).first, 3);
});

test("consensus exposes the lower partner preference rather than averaging away disagreement", () => {
  const votes = [vote("a", "b", "a"), vote("a", "b", "b", "second")];
  const a = consensusStandings(["a", "b"], votes).find(r => r.nameId === "a");
  assert.equal(a.consensus, 0);
  assert.equal(a.complete, true);
  const rows = consensusStandings(["a", "b", "c"], [vote("a", "b", "a"), vote("a", "c", "a"), vote("a", "b", "b", "second"), vote("a", "c", "b", "second"), vote("b", "c", "tie"), vote("b", "c", "tie", "second")]);
  assert.equal(rows[0].rank, 1);
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].consensus === rows[index - 1].consensus) assert.equal(rows[index].rank, rows[index - 1].rank);
    else assert.equal(rows[index].rank, index + 1);
  }
});

test("initial marks remain separate and an explicit neutral rating restores a dismissal", () => {
  const seed = [{ id: "a", initialRatings: { second: "dismissed", first: "neutral" } }, { id: "b", initialRatings: { second: "neutral", first: "dismissed" } }];
  const rows = [{ name_id: "a", person: "first", value: "love", updated_at: time }, { name_id: "b", person: "first", value: "neutral", updated_at: time }];
  const state = buildState(seed, rows, [{ name_id: "a", text: "Shared thought", updated_at: time }], [], []);
  assert.deepEqual(state.ratings.a, { second: "dismissed", first: "love" });
  assert.deepEqual(state.ratings.b, { second: "neutral", first: "neutral" });
  assert.equal(state.notes.a, "Shared thought");
  assert.equal(seed[0].initialRatings.first, "neutral");
  assert.equal(state.updatedAt, time);
});

test("changing catalogs hides incompatible frozen rosters without altering saved records", () => {
  const seed = ["a", "b"].map(id => ({ id, initialRatings: { first: "neutral", second: "neutral" } }));
  const leagues = [
    { id: "current", title: "Current", name_ids: '["a","b"]', created_at: time },
    { id: "previous", title: "Previous", name_ids: '["a","old"]', created_at: time },
  ];
  const votes = ["current", "previous"].map(league_id => ({ league_id, person: "first", a: "a", b: league_id === "current" ? "b" : "old", choice: "a", updated_at: time }));
  const before = JSON.stringify({ leagues, votes });
  const state = buildState(seed, [], [{ name_id: "old", text: "Previous catalog", updated_at: time }], leagues, votes);
  assert.deepEqual(state.leagues.map(league => league.id), ["current"]);
  assert.deepEqual(state.leagues[0].nameIds, ["a", "b"]);
  assert.deepEqual(state.votes.map(vote => vote.leagueId), ["current"]);
  assert.deepEqual(state.notes, {});
  assert.equal(JSON.stringify({ leagues, votes }), before);
});
