# raceme

raceme gives you a speedrun race room that works like SpeedRunsLive did, with the same commands and RaceBot messages. you start a room with a goal and send its link to the people you race with. rooms only exist in the server's memory, so nothing is kept once a room closes.

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

## configuration

the race server reads these environment variables. behind a reverse proxy like caddy, set `RACEME_ORIGIN` and `RACEME_TRUST_PROXY=1`. the server warns at startup when they're missing.

| variable                        | default                        | meaning                                                                                                    |
| ------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `PORT`                          | `8790`                         | port to listen on                                                                                          |
| `RACEME_HOST`                   | `127.0.0.1`                    | address to listen on                                                                                       |
| `RACEME_BASE_PATH`              | none                           | url prefix like `apps/raceme`                                                                              |
| `RACEME_ORIGIN`                 | none                           | the only origin allowed to open rooms and sockets, like `https://ero-qt.eu`. unset turns origin checks off |
| `RACEME_TRUST_PROXY`            | off                            | `1` reads the client address from the last `X-Forwarded-For` entry                                         |
| `RACEME_STATIC_DIR`             | none                           | folder with the built page, usually `dist/client`                                                          |
| `RACEME_INSECURE_COOKIES`       | off                            | `1` drops the `Secure` cookie flag, only for a plain http preview                                          |
| `RACEME_MAX_ROOMS`              | `2048`                         | live rooms at once                                                                                         |
| `RACEME_IDLE_MINUTES`           | `360`                          | minutes a room lives with nobody connected                                                                 |
| `RACEME_IDLE_INPUT_MINUTES`     | `120`                          | minutes a room lives without input from anyone, even with tabs open, before a 5 minute warning             |
| `RACEME_ROOM_HOURS`             | `48`                           | hours a room lives at most, however active it is                                                           |
| `RACEME_SURGE_ROOMS_PER_MINUTE` | `30`                           | rooms per minute, across all visitors, before new rooms need a proof of work                               |
| `RACEME_MAX_SOCKETS_PER_IP`     | `10`                           | open sockets per IPv4 address or IPv6 /64                                                                  |
| `RACEME_MAX_SOCKETS`            | `8192`                         | open sockets in total                                                                                      |
| `RACEME_SPEEDRUN_API`           | `https://www.speedrun.com/api` | where the game picker looks up games and categories. `off` turns the picker off                            |

## license

[0BSD](license.md)
