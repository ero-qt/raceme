#!/usr/bin/env bash
# Runs as root after deploy.sh. When deploy.sh asked for it, it stops raceme, points `current` at
# the prepared release, starts raceme and checks it answers with the new commit. A release that
# doesn't come up is rolled back and never tried again.
set -euo pipefail

root="${RACEME_ROOT:-/srv/raceme}"
health="${RACEME_HEALTH_URL:-http://127.0.0.1:8790/apps/raceme/api/build}"
systemctl="${RACEME_SYSTEMCTL:-systemctl}"
keep=3

[[ -f "$root/swap" && -f "$root/pending" ]] || exit 0
tag=$(cat "$root/pending")
rm -f "$root/swap" "$root/pending"
# The raceme user writes `pending`, so only a release tag may reach the paths below.
[[ "$tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "pending tag '$tag' isn't a release tag" >&2; exit 1; }
commit=$(cat "$root/releases/$tag/commit")
previous=$(readlink "$root/current" 2>/dev/null || true)

switch() {
  "$systemctl" stop raceme.service
  ln -sfn "$1" "$root/current.next"
  mv -T "$root/current.next" "$root/current"
  "$systemctl" start raceme.service
}
switch "releases/$tag"

for _ in $(seq 30); do
  if curl -fsS --max-time 5 "$health" 2>/dev/null | grep -q "\"commit\":\"$commit\""; then
    find "$root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn |
      tail -n +$((keep + 1)) | cut -d' ' -f2- | xargs -r rm -rf
    echo "deployed $tag"
    exit 0
  fi
  sleep 1
done

echo "$tag didn't come up, rolling back to ${previous:-nothing}" >&2
touch "$root/releases/$tag.failed"
if [[ -n "$previous" ]]; then
  switch "$previous"
fi
exit 1
