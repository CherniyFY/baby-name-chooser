import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Bundle the client helper's normal TS extensionless imports for Node's test runner.
const built = await build({ entryPoints: [fileURLToPath(new URL("../lib/tournament-suggestions.ts", import.meta.url))], bundle: true, platform: "node", format: "esm", write: false });
const { suggestTournamentSeeds } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

const ids = ["a", "b", "c", "d", "e"];
const ratings = { a: { first: "love", second: "like" }, b: { first: "love", second: "neutral" }, c: { first: "like", second: "dismissed" }, d: { first: "veto", second: "love" }, e: { first: "neutral", second: "neutral" } };

test("family proposals prioritize mutual interest and never promote dismissals or vetoes", () => {
  const result = suggestTournamentSeeds(ids, ratings, [], [], "ratings", 8);
  assert.deepEqual(result.nameIds, ["a", "b", "e"]);
  assert.equal(result.eligibleCount, 3);
  assert.equal(result.provisional, true);
});

test("a partial league uses played-match rates, excludes vetoes and labels uncertainty", () => {
  const league = { id: "league", title: "Круг", nameIds: ids, createdAt: "0" };
  const vote = (a, b, choice, person = "first") => ({ leagueId: "league", a, b, choice, person, updatedAt: "0" });
  const votes = [vote("a", "b", "b"), vote("a", "b", "b", "second"), vote("a", "c", "a"), vote("a", "d", "a")];
  const result = suggestTournamentSeeds(ids, ratings, [league], votes, "league", 8);
  assert.equal(result.nameIds[0], "b");
  assert.ok(!result.nameIds.includes("c") && !result.nameIds.includes("d"));
  assert.equal(result.provisional, true);
  assert.equal(result.hasVotes, true);
  assert.match(result.label, /Круг/);
});

test("a finished league proposal records completed evidence without inferring manual family approval", () => {
  const league = { id: "league", title: "Финал", nameIds: ["a", "e"], createdAt: "0" };
  const votes = ["first", "second"].map(person => ({ leagueId: "league", person, a: "a", b: "e", choice: "b", updatedAt: "0" }));
  const result = suggestTournamentSeeds(ids, ratings, [league], votes, "league", 8);
  assert.deepEqual(result.nameIds, ["e", "a"]);
  assert.equal(result.provisional, false);
  assert.deepEqual(ratings.e, { first: "neutral", second: "neutral" });
});
