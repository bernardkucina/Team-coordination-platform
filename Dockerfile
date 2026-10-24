# One image, one process: the Express backend serves the API and the built Next.js frontend.
FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate -w backend && npm run build -w frontend

ENV NODE_ENV=production
ENV SERVE_FRONTEND=true

# Apply migrations, load the sandbox data on the first deploy only, then start.
CMD ["sh", "-c", "npm run db:deploy -w backend && npm run db:seed -w backend -- --if-empty && npm run start -w backend"]
