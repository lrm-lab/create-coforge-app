import { Hono } from "hono";
import { createApp as createActions, createHandlers } from "./app.js";
import { createNotes } from "./notes.js";
import { createCoforgeClient } from "./oidc.js";
import { page } from "./views.js";
import { createApp as createWebApp } from "./web-app.js";

export function createService(config, {
  webClient = createCoforgeClient(config, { refreshProfiles: true }),
  agentKeys,
  notes = createNotes(),
} = {}) {
  const app = new Hono();
  app.route("/", createWebApp(config, {
    client: webClient,
    render: (session, notice) => page(session, notice, notes),
  }));
  app.route("/", createActions(config, { keys: agentKeys, handlers: createHandlers(notes) }));
  return app;
}
