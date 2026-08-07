# --- dependency stage ---
FROM oven/bun:1.3.13 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- build stage ---
FROM dependencies AS build
COPY . .
RUN bun run build

# --- production dependency stage ---
FROM oven/bun:1.3.13 AS production-dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime stage ---
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
COPY --from=build /app/build ./build
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER node
EXPOSE 8080
CMD ["node", "build"]
