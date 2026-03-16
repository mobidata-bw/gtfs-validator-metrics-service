# syntax=docker/dockerfile:1

# todo: keep up-to-date using renovate
FROM ghcr.io/mobilitydata/gtfs-validator:7.1.0@sha256:1eefdbb5d25cbf478a137179a5ecf2681e78521384dc051994f8c33bb09d158e AS gtfs-validator

FROM node:24-alpine

WORKDIR /app

RUN --mount=type=cache,target=/var/log,sharing=locked \
	apk add --no-cache \
	openjdk17-jre

COPY --from=gtfs-validator /gtfs-validator-cli.jar /opt/gtfs-validator-cli.jar

ENV NODE_ENV=production

ADD package.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
	--mount=type=cache,target=/tmp/node-compile-cache,sharing=locked \
	npm install --omit dev && npm cache clean --force

ADD . .

ENTRYPOINT [ ]
CMD ["/app/cli.js"]
