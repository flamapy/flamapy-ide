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

# Stage 3: Production Build
FROM base AS build

# Set environment to production
ENV NODE_ENV=production

# Build the app
RUN npm run build

# Stage 4: Production - Nginx for serving static files
FROM nginx:alpine AS prod

# Set environment to production
ENV NODE_ENV=production

# Copy built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration, if needed (optional)
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80 for the Nginx server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
