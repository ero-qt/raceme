# changelog

all notable changes to this project will be documented in this file.  
it follows [keep a changelog](https://keepachangelog.com) principles and raceme adheres to [semantic versioning](https://semver.org).

## [Unreleased]

### Added

- race rooms that work like SpeedRunsLive's: open one from a goal, share the invite link and race with SRL's commands and RaceBot's lines
- results as text for a chat, CSV, JSON or an image with medals for the top places, each to save or copy, once a race is over
- goal suggestions on the start page and for the host in a room, from your past goals and from speedrun.com's games and categories, with the past goals kept only in your browser
- browser tests and `bun run audit`, which check that a race stays on raceme's server and passes axe's WCAG AAA rules
- rooms close 48 hours after they open, with a RaceBot warning 1 hour before and a timer next to the site name that you can hide
- a short proof of work in the browser for new rooms while lots of rooms open at once, plus a limit on new rooms per network
- a closed room keeps its results and downloads on screen with the reason it closed, also after a reload in the same tab
- rooms where nobody has used the mouse, touch or keyboard for 2 hours close after a 10 minute warning, even with tabs still open, except while a race is running
- a slow mode for chat, where each entrant can send 1 line of up to 512 characters every 3 seconds
- SRL commands like `.ready` and `.done` typed in the chat box, plus Enter anywhere on the page to jump into the chat box
- a mute button for the host next to each entrant, which turns off that entrant's chat until the host unmutes them
- a lock for the host that closes entry before the start, plus a limit on how many can enter
