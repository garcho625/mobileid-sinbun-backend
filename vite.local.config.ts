import vinext from "vinext";
import { defineConfig } from "vite";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

// Standalone configuration: no Sites identity, authentication, or connectors.
export default defineConfig(async () => {
  configureToolEnvironment(process.cwd());
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    envDir: ".sites-runtime/empty-env",
    server: {
      host: "127.0.0.1", port: 5173, strictPort: true,
      fs: { deny: [".env", ".env.*", ".dev.vars", ".dev.vars.*", "**/.git/**", "**/.wrangler/**", "**/.sites-runtime/**", "**/*.{pem,key,jwk}"] },
      watch: { ignored: ["**/.sites-runtime/**", "**/.wrangler/**"] },
    },
    plugins: [vinext(), cloudflare({
      configPath: "wrangler.local.json",
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      persistState: { path: ".wrangler/state" },
      remoteBindings: false,
      inspectorPort: false,
    })],
  };
});
