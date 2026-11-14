import handler from "vinext/server/fetch-handler";
import { authenticate, authenticationResponse } from "../lib/request-auth";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const result = authenticate(request, env, import.meta.env.DEV);
    if (!result.ok) return authenticationResponse(result);
    // With run_worker_first, static files must be fetched after authentication.
    let response: Response | undefined;
    if (!import.meta.env.DEV && env.ASSETS && ["GET", "HEAD"].includes(request.method)
      && !new URL(request.url).pathname.startsWith("/api/")) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) response = asset;
    }
    const resolved = response ?? await handler.fetch(request, env, ctx);
    if (!resolved) return new Response("Unable to serve this request.", { status: 500 });
    const secured = new Response(resolved.body, resolved);
    secured.headers.set("Cache-Control", "private, no-store");
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "same-origin");
    return secured;
  },
};
