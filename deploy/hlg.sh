#!/usr/bin/env bash
set -euo pipefail
readonly name=checkpoint-hlg-web previous=checkpoint-hlg-web-previous
readonly network=checkpoint-hlg-net
exec 9>/home/ubuntu/apps/checkpoint-hlg/.web-deploy.lock
flock -n 9 || { echo 'HLG web deploy already running' >&2; exit 1; }
healthy() {
  local status
  for ((i=0; i<30; i++)); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$name") || return 1
    [[ "$status" == healthy ]] && return 0
    [[ "$status" == unhealthy ]] && return 1
    sleep 3
  done
  return 1
}
rollback() {
  docker inspect "$previous" >/dev/null || return 1
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker rename "$previous" "$name" || return 1
  docker start "$name" >/dev/null || return 1
  healthy
}
if [[ "${1:-}" == --rollback ]]; then rollback; exit; fi
[[ "${1:-}" =~ ^ghcr\.io/atilaalcantara/checkpoint-web:hlg-[0-9a-f]{40}$ ]] || {
  echo 'Only immutable HLG SHA tags are accepted' >&2; exit 1;
}
readonly image=$1
docker network inspect "$network" >/dev/null
docker pull "$image"
had_previous=false
if docker inspect "$name" >/dev/null 2>&1; then
  docker rm -f "$previous" >/dev/null 2>&1 || true
  docker stop "$name" >/dev/null
  if ! docker rename "$name" "$previous"; then
    docker start "$name" >/dev/null
    exit 1
  fi
  had_previous=true
fi
recover() {
  rc=$?
  trap - EXIT
  if ((rc != 0)); then
    docker logs --tail 50 "$name" >&2 2>/dev/null || true
    if "$had_previous"; then rollback || echo 'HLG rollback failed; operator action required' >&2;
    else docker rm -f "$name" >/dev/null 2>&1 || true; fi
  fi
  exit "$rc"
}
trap recover EXIT
docker run -d --name "$name" --restart unless-stopped --network "$network" \
  --memory 128m --cpus 0.25 "$image" >/dev/null
healthy
# Verify runtime configuration as well as the web healthcheck.
docker exec "$name" nginx -t
docker exec "$name" sh -c 'wget -q -O /dev/null --header="Host: localhost" http://127.0.0.1/api/v1/site-status'
echo "HLG web healthy: $image"
