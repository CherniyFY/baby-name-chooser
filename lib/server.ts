import { env } from "cloudflare:workers";
import { authenticate } from "./request-auth";
import { names } from "./catalog";
import type { Person, Rating } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const nameIds = new Set(names.map(n => n.id));
export const ratings = new Set<Rating>(["neutral", "love", "like", "maybe", "dismissed", "veto"]);

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error("Name Garden API request failed", error);
      return json({ error: "Could not save or load shared data. Please try again." }, 500);
    }
  };
}

export async function authorize(request: Request, mutation = false) {
  const user = authenticate(request, env, import.meta.env.DEV);
  if (!user.ok) throw new ApiError(user.status, user.message);
  if (mutation) {
    const origin = request.headers.get("Origin");
    if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, "Changes must come from this app.");
    if (request.headers.get("Sec-Fetch-Site") === "cross-site") throw new ApiError(403, "Cross-site changes are not allowed.");
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ApiError(415, "Expected a JSON request.");
  }
  if (!env.DB) throw new ApiError(503, "Shared storage is unavailable. Please try again shortly.");
  return { db: env.DB, user };
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 24000) throw new ApiError(413, "Request too large.");
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ApiError(400, "Could not read this request. Refresh the page and try again."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "Invalid request format.");
  return data as Record<string, unknown>;
}

export function validName(value: unknown): string {
  if (typeof value !== "string" || !nameIds.has(value)) throw new ApiError(400, "Unknown name.");
  return value;
}

export function validPerson(value: unknown): Person {
  if (value !== "first" && value !== "second") throw new ApiError(400, "Choose a participant profile.");
  return value;
}

export function validRating(value: unknown): Rating {
  if (typeof value !== "string" || !ratings.has(value as Rating)) throw new ApiError(400, "Unknown rating.");
  return value as Rating;
}
