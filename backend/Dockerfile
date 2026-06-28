FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
# SQL files must live next to run.js in dist/migrations/ — __dirname resolves there at runtime
COPY --from=builder /app/src/migrations ./dist/migrations

EXPOSE 3001

CMD ["node", "dist/index.js"]
