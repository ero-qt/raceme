import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { plugin } from "bun";
import { solidAndVanillaExtract } from "./transform-plugin.ts";

// happy-dom replaces these with its own browser copies, which Bun.serve refuses to return.
const bunNetworking = { fetch, Request, Response, Headers, WebSocket, AbortController, URL, Blob };

// Bun serves `import.meta.env` from the process environment, where Vite would fill in `BASE_URL`.
process.env.BASE_URL ??= "/";

GlobalRegistrator.register();
Object.assign(globalThis, bunNetworking);
plugin(solidAndVanillaExtract);
