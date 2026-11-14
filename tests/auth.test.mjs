import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, authenticationResponse } from "../lib/request-auth.ts";

const env = { NAME_GARDEN_PASSWORD: "unit-test-password" };
const request = (credentials, url = "https://names.example.test/") => new Request(url, {
  headers: credentials === undefined ? {} : { Authorization: `Basic ${Buffer.from(credentials).toString("base64")}` },
});

test("a deployed room fails closed until a password is configured", () => {
  assert.equal(authenticate(request(), {}).status, 503);
  assert.equal(authenticate(request(undefined, "http://localhost/"), {}).status, 503);
  assert.equal(authenticate(request(undefined, "https://names.example.test/"), {}, true).status, 503);
});

test("only local development can omit a password", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(authenticate(request(undefined, `http://${host}/`), {}, true).ok, true);
  }
  assert.equal(authenticate(request(undefined, "http://localhost/"), env, true).status, 401);
});

test("authentication rejects absent, wrong, malformed and forged credentials", () => {
  for (const credentials of [undefined, "family:wrong", "other:unit-test-password", "unit-test-password"]) {
    assert.equal(authenticate(request(credentials), env).status, 401);
  }
  const forged = new Request("https://names.example.test/", { headers: {
    "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": "forged@example.test",
    "x-name-garden-auth": "shared-room", Authorization: "Basic %%%",
  } });
  assert.equal(authenticate(forged, env).status, 401);
});

test("a valid password grants access, including custom username and UTF-8", () => {
  assert.equal(authenticate(request("family:unit-test-password"), env).userId, "shared-room");
  assert.equal(authenticate(request("room:páss:word"), { NAME_GARDEN_USERNAME: "room", NAME_GARDEN_PASSWORD: "páss:word" }).ok, true);
});

test("authentication failures cannot be cached and prompt for Basic credentials", () => {
  const response = authenticationResponse(authenticate(request(), env));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("WWW-Authenticate"), /^Basic /);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
