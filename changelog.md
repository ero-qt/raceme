# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A server status card on the start page with the open rooms and people online.
- A line in the chat log when a typed name first reaches the 24-character limit.
- A bar at the bottom of a room on phones to switch between the race and the chat.

### Changed

- One mid-gray look on every page.
- A header bar across the top of every page.
- A footer bar at the bottom of every page with the privacy and build notes as links.
- A column next to the start form that tells what raceme is.
- Smaller buttons and fields.
- Panels like the chat log and the intro have a shadow.
- The site meets WCAG 2.2 AA instead of AAA.
- Everything on the page is lowercase, apart from names like SRL and RaceBot.
- The room has 2 columns, with the goal, invite link and entrants on the left and the clock and chat on the right.
- Bot lines in the room chat show without a name.
- Chat lines in the room chat show as `name: text`.
- Refused commands show as red lines in the chat log.
- The name field keeps your name after `.unenter`.
- Length messages read like "a name needs to be 1-24 characters long."
- The restart notice on the start page reads "all rooms will be closed for a server restart at 10:00 UTC (in 3 h 20 min)!".
- The restart notice on the start page sits in the server status card.
- The start page field's placeholder reads "set goal or paste code".
- **Breaking:** `RACEME_ADMIN_SOCKET` replaces `RACEME_ADMIN_PORT`.
- The notice during a rush of new rooms reads "lots of rooms are being opened right now. please wait a few seconds…".

### Removed

- The theme button and the light theme.
- The "Made with AI" note on the page.
- The line about the Discord message in the privacy note.

### Fixed

- Emoji made of several emoji, like a family, stay whole in names, goals and chat.
- The restart notice on the start page counts down while the page stays open.
- `.startrace` works again after the server replies with an error page instead of a room.
- Focus stays put when another entrant acts after one of your race buttons was refused.
- Messages a tab sends past its own limit no longer count against the limit it shares with other tabs on the same address.
- Screen readers read the closing warning once instead of every second.
- After a race button, focus stays on the page, off `.end` and out of the goal field.
- The closing warning no longer dims the room behind it.
- On phones, screen readers hear new chat and RaceBot lines on the race tab too.
- "entry is closed" and "race is full" show as a red line under the name field instead of as its placeholder.
- On phones, the start page field lines up with the cards and sits as far above them as they are apart.

### Security

- A solved proof of work opens one room, even when the same proof is sent several times at once.
- The session cookie is used only when it has the shape the server mints.
- An uncaught server error answers with a plain error page instead of a stack trace.

## [1.1.2] - 2026-10-26

### Changed

- The privacy notice mentions the Discord message at 5 open rooms or 5 people online too.
- The start page's address has no trailing slash, like `ero-qt.eu/apps/raceme`.

### Fixed

- The entrant table fits on phones, with a finished entrant's time in the Status column and the row buttons under the name.
- The lock next to the entrants heading stays on the heading's line on phones 390 pixels wide or more.

## [1.1.1] - 2026-10-25

### Removed

- The link card for Discord and other chats, along with the page description.

## [1.1.0] - 2026-10-25

### Added

- A line in the privacy notice about the owner getting a Discord message with just the number when open rooms or people online pass 10, 25, 50 and so on.

### Changed

- A queued restart doesn't wait for abandoned rooms, meaning rooms nobody has had open for 10 minutes.
- Abandoned rooms get freed early, longest-abandoned first, when the server is close to its room limit.

## [1.0.1] - 2026-10-25

### Fixed

- RaceBot's countdown line uses "1 second" instead of "1 seconds" when a countdown is 1 second long.

## [1.0.0] - 2026-10-25

### Added

- Race rooms that work like SpeedRunsLive's: open one from a goal, share the invite link and race with SRL's commands and RaceBot's lines.
- Results as text for a chat, CSV, JSON or an image with medals for the top places, each to save or copy, once a race is over.
- Goal suggestions on the start page and for the host in a room, from your past goals and from speedrun.com's games and categories, with the past goals kept only in your browser.
- Browser tests and `bun run audit`, which check that a race stays on raceme's server and passes axe's WCAG AAA rules.
- Rooms close 48 hours after they open, with a RaceBot warning 1 hour before and a timer next to the site name that you can hide.
- A short proof of work in the browser for new rooms while lots of rooms open at once, plus a limit on new rooms per network.
- A closed room keeps its results and downloads on screen with the reason it closed, also after a reload in the same tab.
- Rooms where nobody has used the mouse, touch or keyboard for 2 hours close after a 10 minute warning, even with tabs still open, except while a race is running.
- A slow mode for chat, where each entrant can send 1 line of up to 512 characters every 3 seconds.
- SRL commands like `.ready` and `.done` typed in the chat box, plus Enter anywhere on the page to jump into the chat box.
- A mute button for the host next to each entrant, which turns off that entrant's chat until the host unmutes them.
- A lock for the host that closes entry before the start, plus a limit on how many can enter.
- A count in each room of how many people have it open without entering.
- A privacy notice in the corner of the start page that explains what the server keeps.
- A note in the same corner about raceme being made with a lot of help from AI.
- A build note in the same corner with the commit the server runs and how to check its release.
- New releases restart the server at the next 10:00 UTC, or sooner once no room is open.
- A notice on the start page and in every open room when a restart is queued, with a warning 1 hour before.
- `.done` and `.quit` buttons that stay off for the first 5 seconds after GO.
- A link card for Discord and other chats that never shows a room's goal or entrants.
- A `noindex` header and tag on every page, so search engines leave raceme out.

[Unreleased]: https://github.com/ero-qt/raceme/compare/1.1.2...HEAD
[1.1.2]: https://github.com/ero-qt/raceme/compare/1.1.1...1.1.2
[1.1.1]: https://github.com/ero-qt/raceme/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/ero-qt/raceme/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/ero-qt/raceme/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/ero-qt/raceme/releases/tag/1.0.0
