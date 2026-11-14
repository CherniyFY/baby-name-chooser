import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createFilterViewOnce, writeFilterViewRevision, deleteFilterViewRevision } from "../lib/filter-view-store.ts";

const first = () => ({ scope: "names", title: "Обоим нравится", filtersJson: '{"family":"mutual"}', sort: "alphabet" });
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0003_gigantic_ultimates.sql", import.meta.url), "utf8"));
  const db = { prepare(sql) { return { bind(...args) { return { async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; }, async first() { return sqlite.prepare(sql).get(...args) ?? null; } }; } }; } };
  return { sqlite, db, load: () => sqlite.prepare("SELECT * FROM filter_views WHERE id = 'view-1'").get() };
}
test("lost create-response retries retain one shared view even after another device edits it", async () => {
  const { sqlite, db, load } = database();
  try {
    const created = await createFilterViewOnce(db, "view-1", first(), "papa", "1");
    assert.equal(created.revision, 0);
    const changed = { ...first(), title: "Обоим + латиница", filtersJson: '{"family":"mutual","passport":"match"}' };
    assert.equal(await writeFilterViewRevision(db, "view-1", changed, 0, "mama", "2"), true);
    const replay = await createFilterViewOnce(db, "view-1", first(), "papa", "3");
    assert.equal(replay.title, changed.title);
    assert.equal(replay.revision, 1);
    assert.equal(load().filters_json, changed.filtersJson);
    assert.equal(await createFilterViewOnce(db, "view-1", { ...first(), title: "Другой запрос" }, "papa", "4"), null);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM filter_views").get().n, 1);
  } finally { sqlite.close(); }
});
test("stale replacement and deletion cannot overwrite the other parent's updated view", async () => {
  const { sqlite, db, load } = database();
  try {
    await createFilterViewOnce(db, "view-1", first(), "papa", "1");
    assert.equal(await writeFilterViewRevision(db, "view-1", { ...first(), title: "Новая общая версия" }, 0, "mama", "2"), true);
    assert.equal(await writeFilterViewRevision(db, "view-1", { ...first(), title: "Устаревший экран" }, 0, "papa", "3"), false);
    assert.equal(await deleteFilterViewRevision(db, "view-1", "names", 0), false);
    assert.equal(await deleteFilterViewRevision(db, "view-1", "research", 1), false);
    assert.equal(load().title, "Новая общая версия");
    assert.equal(await deleteFilterViewRevision(db, "view-1", "names", 1), true);
    assert.equal(load(), undefined);
  } finally { sqlite.close(); }
});
