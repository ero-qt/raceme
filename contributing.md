# contributing

## requirements

- bun `>=1.4.0`
- node `>=22.17.0` for `bun run audit` only

## quick start

```bash
bun install
bun run dev:server
bun run dev
```

run the 2 dev commands in separate terminals, then open the vite url from the second one.

## scripts

- `bun run dev` starts the vite dev server for the page
- `bun run dev:server` starts the race server and restarts it on changes
- `bun run start` starts the race server
- `bun run build` builds the page
- `bun run check` runs biome and typescript
- `bun run test` runs the unit tests
- `bun run test:e2e` builds the page and runs the browser tests
- `bun run audit` checks the built page with the EDPS Website Evidence Collector and Pa11y and writes the reports to `audit/`
