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

# Pull in the regenerated wheels so Vite copies them into dist/
COPY --from=wheels /app/public/flamapy ./public/flamapy

# Build the app
RUN npm run build

# Stage 4: Production - Nginx for serving static files
FROM nginx:alpine AS prod

# Set environment to production
ENV NODE_ENV=production

# Copy built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy njs script for the /raw endpoint (UVLHub integration)
COPY nginx/raw.js /etc/nginx/njs/raw.js

# Expose port 80 for the Nginx server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
