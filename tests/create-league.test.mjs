import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createLeagueOnce, LeagueRequestConflict } from "../lib/create-league.ts";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_spotty_microchip.sql", import.meta.url), "utf8"));
  const db = { prepare(sql) { return { bind(...args) { return { async run() { return sqlite.prepare(sql).run(...args); }, async first() { return sqlite.prepare(sql).get(...args); } }; } }; } };
  return { db, sqlite };
}

test("a lost-response retry returns the original league rather than creating or overwriting a room", async () => {
  const { db, sqlite } = database();
  try {
    const league = { id: "12345678-1234-4321-8123-123456789012", title: "Первый круг", nameIds: ["N001", "N002"], createdAt: "2026-11-02T12:00:00.000Z" };
    const first = await createLeagueOnce(db, league, "parent-a");
    const replayed = await createLeagueOnce(db, { ...league, createdAt: "2026-11-02T13:00:00.000Z" }, "parent-a");
    assert.deepEqual(replayed, first);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM leagues").get().count, 1);
    await assert.rejects(createLeagueOnce(db, { ...league, nameIds: ["N001", "N003"] }, "parent-a"), LeagueRequestConflict);
    await assert.rejects(createLeagueOnce(db, { ...league, title: "Другой круг" }, "parent-b"), LeagueRequestConflict);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM leagues").get().count, 1);
    assert.equal(sqlite.prepare("SELECT title FROM leagues").get().title, league.title);
  } finally { sqlite.close(); }
});
