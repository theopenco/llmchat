FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# No npm lockfile exists here (pnpm monorepo — the lockfile lives at the repo
# root), so `npm ci` can never succeed. `npm install` resolves from package.json.
# TODO(hosting phase): switch to a pnpm-based multi-stage build pinned by the
# root pnpm-lock.yaml before any real deploy.
COPY package.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY . .

RUN npm run build:app

CMD ["npm", "run", "docker-start"]
