import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command }) => ({
  server: { host: "127.0.0.1", port: 5173 },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      // Vite must serve its own virtual modules in development. Deployed assets
      // still pass through the password gate before the ASSETS binding.
      config: { assets: { binding: "ASSETS", run_worker_first: command === "build" } },
    }),
  ],
}));
