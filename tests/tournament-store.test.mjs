import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applyTournamentAction } from "../lib/tournament.ts";
import { createTournamentOnce, parseTournament, writeTournamentRevision } from "../lib/tournament-store.ts";

const make = () => ({ id: "t1", title: "Наш финал", nameIds: ["a", "b"], results: [], votes: {}, revision: 0, createdAt: "1", updatedAt: "1" });
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0001_tense_wendell_rand.sql", import.meta.url), "utf8"));
  const db = { prepare(sql) { return { bind(...args) { return { async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; }, async first() { return sqlite.prepare(sql).get(...args) ?? null; } }; } }; } };
  const load = () => parseTournament(sqlite.prepare("SELECT * FROM tournaments WHERE id = 't1'").get());
  return { sqlite, db, load };
}

test("creation replay returns original mutable tournament and rejects a changed seed order", async () => {
  const { sqlite, db } = database();
  try {
    const initial = make();
    assert.deepEqual(await createTournamentOnce(db, initial, "papa"), initial);
    const changed = applyTournamentAction(initial, { action: "vote", person: "first", matchId: "W1-1", winnerId: "a" }, "2");
    assert.equal(await writeTournamentRevision(db, changed, 0, "papa"), true);
    assert.deepEqual(await createTournamentOnce(db, { ...initial, createdAt: "5", updatedAt: "5" }, "papa"), changed);
    assert.equal(await createTournamentOnce(db, { ...initial, nameIds: ["b", "a"] }, "mama"), null);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM tournaments").get().n, 1);
  } finally { sqlite.close(); }
});

test("revision compare-and-swap prevents a stale device from losing the other parent's pick", async () => {
  const { sqlite, db, load } = database();
  try {
    const initial = make(); await createTournamentOnce(db, initial, "papa");
    const papa = applyTournamentAction(initial, { action: "vote", person: "first", matchId: "W1-1", winnerId: "a" }, "2");
    const mamaStale = applyTournamentAction(initial, { action: "vote", person: "second", matchId: "W1-1", winnerId: "a" }, "3");
    assert.equal(await writeTournamentRevision(db, papa, 0, "papa"), true);
    assert.equal(await writeTournamentRevision(db, mamaStale, 0, "mama"), false);
    assert.equal(load().votes["W1-1"].first, "a");
    const mama = applyTournamentAction(load(), { action: "vote", person: "second", matchId: "W1-1", winnerId: "a" }, "4");
    assert.equal(await writeTournamentRevision(db, mama, 1, "mama"), true);
    assert.deepEqual(load().votes["W1-1"], { first: "a", second: "a" });
    assert.equal(load().results[0].winnerId, "a");
    assert.equal(load().revision, 2);
    assert.equal(await writeTournamentRevision(db, papa, 0, "papa"), false);
    assert.equal(load().revision, 2);
  } finally { sqlite.close(); }
});
