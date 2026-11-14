declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ASSETS?: Fetcher;
    NAME_GARDEN_PASSWORD?: string;
    NAME_GARDEN_USERNAME?: string;
  }
}
