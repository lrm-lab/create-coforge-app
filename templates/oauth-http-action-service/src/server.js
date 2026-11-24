import { serve } from "@hono/node-server";
import { MANIFEST_PATH } from "./manifest.js";
import { createService } from "./service.js";
import { loadConfig } from "./web-config.js";

const config = loadConfig();
serve({ fetch: createService(config).fetch, port: config.port }, ({ port }) => {
  console.log(`__APP_NAME__ listening on port ${port}`);
  console.log(`Redirect URI to register: ${config.redirectUri}`);
  console.log(`Manifest: ${config.appOrigin}${MANIFEST_PATH}`);
});
