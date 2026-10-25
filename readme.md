# raceme

raceme gives you a speedrun race room that works like SpeedRunsLive did, with the same commands and RaceBot messages. you start a room with a goal and send its link to the people you race with. rooms only exist in the server's memory, so nothing is kept once a room closes.

## rooms and limits

a room lives only in the server's memory. there are no accounts, no room list and no logs of rooms, goals or chat, so once a room closes nothing about it is left on the server. anyone with the link can open a room and watch it, so share the link only with the people you race with.

a room closes:

- 48 hours after it opened, with a RaceBot warning 1 hour before,
- 10 minutes after `.end`,
- after 2 hours with nobody connected,
- after 2 hours without input from anyone, after a 10 minute warning that any mouse, touch or keyboard input cancels. a running race never counts as idle.

the page shows how long the room has left next to the site name. after a room closes, the tab you had it open in keeps the results so you can still save them.

a race takes up to 50 entrants. chat lines can be up to 512 characters, each entrant can send 1 line every 3 seconds, and nobody can delete a line once it's sent. the host can mute an entrant's chat, remove an entrant before the start, close entry and set a lower entrant limit.

new rooms are limited per address and per network. when lots of rooms open at once, the browser solves a short proof of work before it gets a new room.

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
| `RACEME_IDLE_MINUTES`           | `120`                          | minutes a room lives with nobody connected                                                                 |
| `RACEME_IDLE_INPUT_MINUTES`     | `120`                          | minutes a room lives without input from anyone, even with tabs open, before the warning                    |
| `RACEME_IDLE_WARNING_MINUTES`   | `10`                           | minutes between the idle warning and the room closing                                                      |
| `RACEME_ROOM_HOURS`             | `48`                           | hours a room lives at most, however active it is                                                           |
| `RACEME_CHAT_SECONDS`           | `3`                            | seconds each entrant waits between chat lines                                                              |
| `RACEME_SURGE_ROOMS_PER_MINUTE` | `30`                           | rooms per minute, across all visitors, before new rooms need a proof of work                               |
| `RACEME_MAX_SOCKETS_PER_IP`     | `10`                           | open sockets per IPv4 address or IPv6 /64                                                                  |
| `RACEME_MAX_SOCKETS`            | `8192`                         | open sockets in total                                                                                      |
| `RACEME_SPEEDRUN_API`           | `https://www.speedrun.com/api` | where the game picker looks up games and categories. `off` turns the picker off                            |

## license

[0BSD](license.md)
