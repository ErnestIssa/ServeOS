# Unified ServeOS API — single process (auth + restaurants + orders + WebSockets).
# Aligns with docs/deploymentArchitecture.md (one backend on Render).
FROM node:22-alpine
WORKDIR /app

COPY . .

RUN npm ci

# Bundles + generates Prisma client (prisma:generate is part of the api build)
RUN npm run build:backend

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Apply pending SQL migrations before serving (avoids Prisma/runtime errors when schema drifts from Neon).
CMD ["sh", "-c", "npx prisma migrate deploy --schema core/database/prisma/schema.prisma && npm run start -w @serveos/api"]
