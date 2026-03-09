FROM gcr.io/distroless/nodejs24-debian12 AS runner
FROM node:24-trixie AS base

FROM base AS dev
WORKDIR /app
COPY .yarn ./.yarn
COPY .yarnrc.yml package.json yarn.lock ./
RUN yarn install
RUN npm install -g tsx
CMD ["yarn", "dev"]

FROM base AS deps
WORKDIR /app
COPY .yarn ./.yarn
COPY .yarnrc.yml package.json yarn.lock ./
RUN yarn workspaces focus --production

FROM base AS build
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build

FROM runner AS prod
WORKDIR /app
COPY --from=build /app/dist/ ./
COPY --from=deps /app/node_modules ./node_modules
CMD ["--max-old-space-size=512", "server.js"]
