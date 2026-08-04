# ==========================================
# STAGE 1: BUILD
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install packages
RUN npm ci

# Copy code and build configuration
COPY . .

# Build Vite static assets
RUN npm run build

# ==========================================
# STAGE 2: WEB SERVER (NGINX)
# ==========================================
FROM nginx:stable-alpine AS runner

# Copy nginx config for single page app routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build folder from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
