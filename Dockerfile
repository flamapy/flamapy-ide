# Stage 1: Base Image
FROM node:18 AS base

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json for installation
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Stage 2: Development
FROM base AS dev

# Set environment to development
ENV NODE_ENV=development

# Expose Vite default port
EXPOSE 5173

# Start the Vite development server
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 3: Regenerate the flamapy wheels served to the browser.
# These wheels are not tracked in git (see .gitignore); `make build-wheels`
# rebuilds them from flamapy.version + the Makefile dep list. The two manually
# vendored wheels (flamapy-configurator, z3_solver wasm) are copied in from the
# build context, which `make build-wheels` leaves untouched.
FROM python:3.11 AS wheels
WORKDIR /app
COPY Makefile flamapy.version ./
COPY scripts ./scripts
COPY public/flamapy ./public/flamapy
RUN make build-wheels

# Stage 4: Production Build
FROM base AS build

# Set environment to production
ENV NODE_ENV=production

# Google Analytics 4 measurement ID. Vite inlines this into the static bundle at
# build time, so it must be present here (not at container runtime). Passed via
# --build-arg from a GitHub secret in CI; empty by default, which leaves GA off.
ARG VITE_GA_MEASUREMENT_ID
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID

# Collaboration is a build-time Vite flag. The all-in-one image below ships the
# collab backend in the same container (nginx reverse-proxies it at /collab), so
# it is ON by default. VITE_COLLAB_URL is left empty on purpose: the frontend then
# derives the WebSocket URL from the page's own origin (ws(s)://<host>/collab), so
# the same image works on localhost or any domain with no rebuild. Set the arg only
# to point at an external collab server instead.
ARG VITE_ENABLE_COLLAB=true
ARG VITE_COLLAB_URL=
ENV VITE_ENABLE_COLLAB=$VITE_ENABLE_COLLAB
ENV VITE_COLLAB_URL=$VITE_COLLAB_URL

# Pull in the regenerated wheels so Vite copies them into dist/
COPY --from=wheels /app/public/flamapy ./public/flamapy

# Build the app
RUN npm run build

# Stage 5: Production — a single self-contained image that serves the app AND runs
# the collaboration backend, so deployers just `docker run` one image (no Node on
# the host, no second container, no compose). nginx serves the static site on :80
# and reverse-proxies /collab to the Y.js WebSocket server running on localhost:1234
# inside this same container; an entrypoint starts both processes.
FROM nginx:alpine AS prod

ENV NODE_ENV=production
# The collab server only needs to be reachable by nginx within the container.
ENV COLLAB_HOST=127.0.0.1
ENV COLLAB_PORT=1234

# nginx:alpine bundles the njs module (used by /raw); add Node for the collab server.
RUN apk add --no-cache nodejs

WORKDIR /app

# The built static site…
COPY --from=build /app/dist /usr/share/nginx/html
# …the collab server and its runtime deps (ws / y-websocket / yjs live in node_modules)…
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/server ./server
COPY --from=base /app/package.json ./package.json

# nginx config (now also proxies /collab) + the njs /raw handler + the entrypoint.
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx/raw.js /etc/nginx/njs/raw.js
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
