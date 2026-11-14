import { createHash, timingSafeEqual } from "node:crypto";

export type AuthEnvironment = {
  NAME_GARDEN_PASSWORD?: string;
  NAME_GARDEN_USERNAME?: string;
};
export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503; message: string };

/** One private room with two selectable profiles. Profiles are attribution, not accounts. */
export function authenticate(request: Request, env: AuthEnvironment, development = false): AuthResult {
  const hostname = new URL(request.url).hostname;
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  if (!env.NAME_GARDEN_PASSWORD) {
    if (development && loopback) return { ok: true, userId: "local-development" };
    return { ok: false, status: 503, message: "Set the NAME_GARDEN_PASSWORD secret before opening this room." };
  }
  const authorization = request.headers.get("Authorization") || "";
  let credentials = "";
  if (/^Basic /i.test(authorization)) {
    try { credentials = Buffer.from(authorization.slice(6), "base64").toString("utf8"); }
    catch { /* malformed credentials are rejected below */ }
  }
  const expected = `${env.NAME_GARDEN_USERNAME || "family"}:${env.NAME_GARDEN_PASSWORD}`;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(credentials), digest(expected))) {
    return { ok: false, status: 401, message: "Sign in with this room's username and password." };
  }
  return { ok: true, userId: "shared-room" };
}

export function authenticationResponse(result: Extract<AuthResult, { ok: false }>): Response {
  return new Response(result.message, {
    status: result.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(result.status === 401 ? { "WWW-Authenticate": 'Basic realm="Name Garden", charset="UTF-8"' } : {}),
    },
  });
}
