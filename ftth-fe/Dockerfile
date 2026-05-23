# ==========================================
# BUILD STAGE
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package.json package-lock.json ./
RUN npm ci

# Copy codebase
COPY . .

# Build production bundle
# Vite reads .env files or environment variables starting with VITE_ during build
RUN npm run build

# ==========================================
# RUN STAGE
# ==========================================
FROM nginx:alpine

# Copy SPA static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx config for client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
