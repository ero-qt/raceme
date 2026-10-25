# changelog

all notable changes to this project will be documented in this file.  
it follows [keep a changelog](https://keepachangelog.com) principles and raceme adheres to [semantic versioning](https://semver.org).

## [Unreleased]

### Added

- race rooms that work like SpeedRunsLive's: open one from a goal, share the invite link and race with SRL's commands and RaceBot's lines
- result download as CSV or JSON once a race is over
- goal suggestions on the start page and for the host in a room, from your past goals and from speedrun.com's games and categories, with the past goals kept only in your browser
- browser tests and `bun run audit`, which check that a race stays on raceme's server and passes axe's WCAG AAA rules
- rooms close 72 hours after they open, with a RaceBot warning 1 hour before
- rooms where nobody has done anything for 2 hours close after a 15 minute warning, even with tabs still open
