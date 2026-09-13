// Veilance Party Agent — entrypoint.
//
// Starts the HTTP server immediately (GET /health responds right away with
// `ready: false`) and kicks off bootstrap() in the background — health
// checks, wallet funding, DUST registration, and provider construction can
// take up to a minute (see agent/API.md's startup note).

import { serve } from "@hono/node-server";
import { app } from "./routes.js";
import { bootstrap } from "./bootstrap.js";
import { loadChallenges } from "./state.js";
import { appState } from "./appState.js";
import { PORT, CORS_ORIGIN } from "./config.js";

appState.challenges = loadChallenges();

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Veilance Party Agent listening on http://localhost:${info.port} (CORS: ${CORS_ORIGIN})`);
  console.log(`GET /health will report { ready: false } until bootstrap finishes.`);
});

void bootstrap();

const shutdown = () => {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
