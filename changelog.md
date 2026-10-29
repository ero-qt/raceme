# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- One mid-gray look for everyone, without a theme button or a light theme.
- A header bar across the top of every page and a footer bar with the privacy, AI and build notes at the bottom.
- The start page has a column next to the form that tells what raceme is and how a race goes.
- Buttons, fields and the footer notes are smaller.
- Panels like the chat log and the intro have a shadow and a lighter surface.
- The site meets WCAG 2.2 AA instead of AAA, which allows richer status colors.

- Bot lines in the room chat show without a name.
- Chat lines in the room chat show as `name: text`.

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
