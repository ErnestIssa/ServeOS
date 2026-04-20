# Unified ServeOS API — single process (auth + restaurants + orders + WebSockets).
# Aligns with docs/deploymentArchitecture.md (one backend on Render).
FROM node:22-alpine
WORKDIR /app

COPY . .

RUN npm ci

RUN npx prisma generate --schema=core/database/prisma/schema.prisma

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@serveos/api"]
