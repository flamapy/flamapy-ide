#!/bin/sh
# Entrypoint for the collab (:develop) image. Runs two processes in one
# container: the Y.js collab server (loopback only, fronted by nginx) and nginx
# serving the SPA. If either exits, the container exits so the orchestrator
# (Watchtower) can restart it cleanly. Written for busybox ash (no `wait -n`).
set -e

# Collab server, bound to loopback — only reachable through the nginx /collab
# reverse proxy, never published directly.
COLLAB_HOST=127.0.0.1 COLLAB_PORT=1234 node /collab/server/collab-server.js &
collab_pid=$!

# nginx in the foreground process group.
nginx -g 'daemon off;' &
nginx_pid=$!

# Forward termination signals to both children.
trap 'kill "$collab_pid" "$nginx_pid" 2>/dev/null' TERM INT

# Poll: as soon as either process is gone, stop the container (non-zero exit so
# the orchestrator restarts it).
while kill -0 "$collab_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 5
done

kill "$collab_pid" "$nginx_pid" 2>/dev/null || true
exit 1
