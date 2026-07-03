#!/bin/sh
# Single production image: run the Y.js collaboration backend in the background and
# nginx in the foreground (nginx becomes the container's main process; the collab
# server is torn down with the container). nginx reverse-proxies /collab to it.
set -e

node /app/server/collab-server.js &
exec nginx -g 'daemon off;'
