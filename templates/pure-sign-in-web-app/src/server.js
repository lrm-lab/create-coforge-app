import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
serve({ fetch: createApp(config).fetch, port: config.port }, ({ port }) => {
  console.log(`__APP_NAME__ listening on ${config.appOrigin} (port ${port})`);
  console.log(`Redirect URI to register: ${config.redirectUri}`);
});
