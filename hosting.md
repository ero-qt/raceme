# hosting

the race server reads these environment variables. behind a reverse proxy like caddy, set `RACEME_ORIGIN` and `RACEME_TRUST_PROXY=1`. the server warns at startup when they're missing.

## network

| variable                  | default     | meaning                                                                                                    |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `PORT`                    | `8790`      | port to listen on                                                                                          |
| `RACEME_HOST`             | `127.0.0.1` | address to listen on                                                                                       |
| `RACEME_BASE_PATH`        | none        | url prefix like `apps/raceme`                                                                              |
| `RACEME_ORIGIN`           | none        | the only origin allowed to open rooms and sockets, like `https://ero-qt.eu`. unset turns origin checks off |
| `RACEME_TRUST_PROXY`      | off         | `1` reads the client address from the last `X-Forwarded-For` entry                                         |
| `RACEME_STATIC_DIR`       | none        | folder with the built page, usually `dist/client`                                                          |
| `RACEME_INSECURE_COOKIES` | off         | `1` drops the `Secure` cookie flag, only for a plain http preview                                          |

## limits

| variable                        | default | meaning                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `RACEME_MAX_ROOMS`              | `2048`  | live rooms at once                                                           |
| `RACEME_MAX_SOCKETS`            | `8192`  | open sockets in total                                                        |
| `RACEME_MAX_SOCKETS_PER_IP`     | `10`    | open sockets per IPv4 address or IPv6 /64                                    |
| `RACEME_SURGE_ROOMS_PER_MINUTE` | `30`    | rooms per minute, across all visitors, before new rooms need a proof of work |
| `RACEME_CHAT_SECONDS`           | `3`     | seconds each entrant waits between chat lines                                |

## lifetimes

| variable                      | default | meaning                                                                                                                             |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `RACEME_ROOM_HOURS`           | `48`    | hours a room lives at most, however active it is. the host cookie lives as long. the privacy note prints 2 days, so change that too |
| `RACEME_IDLE_MINUTES`         | `120`   | minutes a room lives with nobody connected                                                                                          |
| `RACEME_IDLE_INPUT_MINUTES`   | `120`   | minutes a room lives without input from anyone, even with tabs open, before the warning                                             |
| `RACEME_IDLE_WARNING_MINUTES` | `10`    | minutes between the idle warning and the room closing                                                                               |
| `RACEME_RESTART_HOUR_UTC`     | `10`    | hour in UTC a queued restart happens, earlier once all rooms are closed                                                             |

## integrations

| variable                    | default                        | meaning                                                                                               |
| --------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `RACEME_SPEEDRUN_API`       | `https://www.speedrun.com/api` | where the game picker looks up games and categories. `off` turns the picker off                       |
| `RACEME_BUILD_FILE`         | none                           | JSON file the deploy writes with the release's repository, commit and digest, shown in the build note |
| `RACEME_ALERT_WEBHOOK_FILE` | none                           | file with a Discord webhook URL that gets a message when rooms or people online pass 5, 10, 25, 50, … |
| `RACEME_ADMIN_SOCKET`       | none                           | unix socket where the deploy script queues a restart and reads the open room count                    |

## the reverse proxy

the server sends its own security headers, among them a content security policy, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`. it serves the page uncompressed. the proxy in front of it should:

- turn its access log off for the raceme site or strip the client address from it. the privacy note promises that no visitor data is saved,
- compress responses, like `encode zstd gzip` in caddy, which cuts the page's script to about a third,
- send `Strict-Transport-Security` once the site is only ever served over https, since the server doesn't know whether it is.
