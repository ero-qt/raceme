import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { startServer } from "../src/server/server.ts";

// Audits the built page with 2 outside tools: the EDPS Website Evidence Collector for data
// protection and Pa11y for accessibility. Both run on Node and drive Chrome through Puppeteer.

const root = join(import.meta.dir, "..");
const out = join(root, "audit");

if (!Bun.which("node")) {
  console.error("Requires Node.js 22.17 or later on PATH.");
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const server = startServer({
  port: 0,
  hostname: "127.0.0.1",
  secureCookies: true,
  basePath: "",
  origin: null,
  staticDir: join(root, "dist", "client"),
  trustProxy: false,
  speedrunApi: null,
  maxRooms: 10,
  idleMs: 60_000,
  idleInputMs: 2 * 60 * 60_000,
  idleWarningMs: 10 * 60_000,
  roomLifetimeMs: 48 * 60 * 60_000,
  closingWarningMs: 60 * 60_000,
  unusedRoomMs: 10 * 60_000,
  surgeRoomsPerMinute: 1000,
  surgeBits: 8,
  countdownMs: 10_000,
  chatEveryMs: 3_000,
  maxSocketsPerIp: 50,
  maxSockets: 100,
  sweepIntervalMs: 60_000,
});

const origin = `http://localhost:${server.server.port}`;
const created = await fetch(`${origin}/api/rooms`, {
  method: "POST",
  body: JSON.stringify({ goal: "sm64 16 star" }),
});
const { slug } = (await created.json()) as { slug: string };

const pages = { start: `${origin}/`, room: `${origin}/${slug}` };

const env = {
  ...process.env,
  PUPPETEER_EXECUTABLE_PATH: join(import.meta.dir, "audit-chrome.sh"),
  RACEME_AUDIT_CHROME: chromium.executablePath(),
};

function run(command: string[]): Promise<number> {
  const child = Bun.spawn(command, { cwd: root, env, stdout: "ignore", stderr: "inherit" });
  return child.exited;
}

const failures: string[] = [];
const print = (line: string) => process.stdout.write(`${line}\n`);

for (const [name, url] of Object.entries(pages)) {
  const folder = join(out, `edps-${name}`);
  await run([
    "node_modules/.bin/website-evidence-collector",
    url,
    ...["-f", origin, "-o", folder, "--overwrite", "-q"],
  ]);

  const inspection = await Bun.file(join(folder, "inspection.json")).json();
  const thirdParty = Object.entries(inspection.hosts as Record<string, { thirdParty: string[] }>)
    .filter(([, hosts]) => hosts.thirdParty.length > 0)
    .map(([kind, hosts]) => `${kind}: ${hosts.thirdParty.join(", ")}`);

  print(`edps ${name}: third-party ${thirdParty.length}, beacons ${inspection.beacons.length}`);
  failures.push(...thirdParty.map((host) => `edps ${name} third-party ${host}`));
  if (inspection.beacons.length > 0) {
    failures.push(`edps ${name} found beacons`);
  }
}

const pa11yActions: Record<keyof typeof pages, string[]> = {
  // axe can't rate the contrast of an empty field, so the start page gets a goal typed in first.
  start: ["set field input[aria-label='Goal or room code'] to sm64 16 star"],
  room: [],
};
for (const [name, url] of Object.entries(pages) as [keyof typeof pages, string][]) {
  const config = join(out, `pa11y-${name}.config.json`);
  await Bun.write(
    config,
    JSON.stringify({
      standard: "WCAG2AAA",
      runners: ["htmlcs", "axe"],
      actions: pa11yActions[name],
    }),
  );

  const report = join(out, `pa11y-${name}.json`);
  const child = Bun.spawn(
    ["node_modules/.bin/pa11y", "--config", config, "--reporter", "json", url],
    { cwd: root, env, stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(child.stdout).text();

  // Pa11y exits with 2 when it finds issues and with 1 when it couldn't check the page at all.
  if ((await child.exited) === 1) {
    failures.push(`pa11y ${name} failed to run`);
    continue;
  }

  const issues = JSON.parse(output) as unknown[];
  await Bun.write(report, JSON.stringify(issues, null, 2));
  print(`pa11y ${name}: ${issues.length} issues`);
  if (issues.length > 0) {
    failures.push(`pa11y ${name}: ${issues.length} issues, see ${report}`);
  }
}

server.stop();

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
print(`reports in ${out}`);
