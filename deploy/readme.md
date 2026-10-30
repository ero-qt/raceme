# deploy

raceme runs from attested GitHub releases. A timer on the server runs 2 scripts every 10 minutes:

1. `deploy.sh` runs as the `raceme` user. When a new release shows up, it downloads it, checks its attestation with `gh attestation verify`, unpacks it into `/srv/raceme/releases/<tag>` next to the running one and asks the server to queue a restart for the next 10:00 UTC. All open rooms then close at that time and get a warning in their chat. After that it checks the open room count on each run and asks for the switch once all rooms are closed or 10:00 UTC has come.
2. `swap.sh` runs as root. When asked, it stops raceme, points `/srv/raceme/current` at the new release and starts raceme again. If the new release doesn't answer on `/api/build` with its commit within 30 seconds, it switches back and marks the release as failed, so it's never tried again.

## one-time setup

This needs root, Bun in `/usr/local/bin` and a `gh` that has `gh attestation` (2.49 or newer, from GitHub's apt repo).

```bash
sudo useradd --system --home-dir /srv/raceme --shell /usr/sbin/nologin raceme
sudo install -d -o raceme -g raceme /srv/raceme /srv/raceme/releases /srv/raceme-preview
sudo install -D -m 755 deploy/deploy.sh deploy/swap.sh -t /usr/local/lib/raceme/
sudo install -m 644 deploy/*.service deploy/*.timer /etc/systemd/system/
sudo install -D -m 600 /dev/null /etc/raceme/preview.env
echo 'RACEME_ORIGIN=<the preview origin>' | sudo tee /etc/raceme/preview.env
sudo systemctl daemon-reload
sudo systemctl enable --now raceme-deploy.timer
sudo systemctl start raceme-deploy.service
sudo systemctl enable --now raceme.service raceme-preview.service
```

Then point the reverse proxy at `127.0.0.1:8790` for `/apps/raceme/`. Port 8796 is the admin port and stays unproxied.

## preview

The preview runs a local build as the `raceme` user:

```bash
RACEME_BASE_PATH=apps/raceme bun run release
sudo rsync -a --delete release/ /srv/raceme-preview/
sudo systemctl restart raceme-preview
```

## releasing

1. In a pull request, rename `## [Unreleased]` in `changelog.md` to `## [1.2.0] - 2026-10-25` with the new version and today's date. Add an empty `## [Unreleased]` above it.
2. Once it's merged, tag the merge commit on `main` and push the tag:

   ```bash
   git tag 1.2.0 origin/main
   git push origin 1.2.0
   ```

The release workflow refuses a tag that isn't on `main` or has no changelog section. It runs every check and test, builds the tarball, attests it and publishes the release `v1.2.0` with the merged pull requests as its notes. The server picks it up within 10 minutes.

To check a release yourself, rebuild it from its tag with the Bun version in `.bun-version` and compare the digests:

```bash
git checkout 1.2.0
RACEME_BASE_PATH=apps/raceme bun run release
sha256sum raceme.tar.gz
```
