import { configWarnings, loadConfig } from "./config.ts";
import { startServer } from "./server/server.ts";

const config = loadConfig(process.env);
for (const warning of configWarnings(config)) {
  console.warn(`warning: ${warning}`);
}

const { server } = startServer(config);
console.warn(`raceme listening on ${server.url}`);
