# ==========================================
# STAGE 1: BUILD
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and lockfiles
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for typescript compilation)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma Client and compile Typescript
RUN npx prisma generate
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# ==========================================
# STAGE 2: RUNTIME
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Configure node environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Install openssl for Prisma Client execution on alpine
RUN apk add --no-cache openssl

# Copy build artifacts and runtime configuration from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose Express server port
EXPOSE 5000

# Start script: run prisma migrations, then boot up production server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
