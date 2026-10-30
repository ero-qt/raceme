#!/usr/bin/env bash
# Runs as the raceme user every 10 minutes. It prepares the newest attested release next to the
# running one and queues a restart for it, then asks swap.sh to switch once all rooms are closed or
# the queued restart time has come.
set -euo pipefail

repo="${RACEME_REPO:-ero-qt/raceme}"
github="${RACEME_GITHUB:-https://github.com}"
root="${RACEME_ROOT:-/srv/raceme}"
admin_socket="${RACEME_ADMIN_SOCKET:-/run/raceme/admin.sock}"
fetch=(curl -fsS --max-time 60)
admin=("${fetch[@]}" --unix-socket "$admin_socket" http://raceme/restart)

if [[ ! -f "$root/pending" ]]; then
  # GitHub answers /releases/latest with a redirect to the newest tag, so no API token is needed.
  latest=$("${fetch[@]}" -o /dev/null -w '%{redirect_url}' "$github/$repo/releases/latest")
  tag="${latest##*/}"
  if [[ ! "$tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "no release tag in '$latest'" >&2
    exit 1
  fi
  if [[ "$(readlink "$root/current" 2>/dev/null)" == "releases/$tag" || -e "$root/releases/$tag.failed" ]]; then
    exit 0
  fi

  work=$(mktemp -d)
  trap 'rm -rf "$work"' EXIT
  for file in raceme.tar.gz raceme.tar.gz.sigstore.json; do
    "${fetch[@]}" -L -o "$work/$file" "$github/$repo/releases/download/$tag/$file"
  done

  gh attestation verify "$work/raceme.tar.gz" \
    --bundle "$work/raceme.tar.gz.sigstore.json" \
    --repo "$repo" \
    --signer-workflow "$repo/.github/workflows/release.yml" \
    --source-ref "refs/tags/$tag" \
    --deny-self-hosted-runners

  target="$root/releases/$tag"
  rm -rf "$target"
  mkdir -p "$target"
  tar -xzf "$work/raceme.tar.gz" -C "$target"
  digest="sha256:$(sha256sum "$work/raceme.tar.gz" | cut -d' ' -f1)"
  printf '{"release":"%s","repository":"%s","commit":"%s","digest":"%s"}\n' \
    "$tag" "$github/$repo" "$(cat "$target/commit")" "$digest" > "$target/build.json"

  echo "$tag" > "$root/pending"
  # A first install has no running server to queue a restart on, so it switches right away.
  if [[ ! -e "$root/current" ]]; then
    touch "$root/swap"
    echo "prepared $tag, nothing runs yet"
    exit 0
  fi
  "${admin[@]}" -X POST -o /dev/null
  echo "prepared $tag, restart queued"
fi

# The server answers like {"restartAt":1761386400000,"rooms":2}.
status=$("${admin[@]}")
rooms=$(sed -E 's/.*"rooms":([0-9]+).*/\1/' <<< "$status")
restart_at=$(sed -E 's/.*"restartAt":([0-9]+).*/\1/;t;s/.*/0/' <<< "$status")
if [[ "$rooms" == 0 || ( "$restart_at" != 0 && $(( $(date +%s) * 1000 )) -ge "$restart_at" ) ]]; then
  touch "$root/swap"
elif [[ "$restart_at" == 0 ]]; then
  # The server lost the queued restart, like after a crash, so it gets queued again.
  "${admin[@]}" -X POST -o /dev/null
fi
