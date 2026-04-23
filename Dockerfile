# syntax=docker/dockerfile:1

# todo: keep up-to-date using renovate
FROM ghcr.io/mobilitydata/gtfs-validator:30.0.0@sha256:a424948c31a4a03fcd7b6a0025148476cd82542c1020d5ca0a97c419a6d8b962 AS gtfs-validator

FROM node:24-alpine

WORKDIR /app

# curl is needed for health checking
RUN --mount=type=cache,target=/var/log,sharing=locked \
	apk add --no-cache \
	curl \
	openjdk17-jre

COPY --from=gtfs-validator /gtfs-validator-cli.jar /opt/gtfs-validator-cli.jar

ENV NODE_ENV=production
# Let Node.js listen not on `lo` (loopback interface) but on all interfaces, so that it is available non-locally.
ENV HTTP_LISTEN_HOST='0.0.0.0'

ADD package.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
	--mount=type=cache,target=/tmp/node-compile-cache,sharing=locked \
	npm install --omit dev && npm cache clean --force

ADD . .

HEALTHCHECK --interval=15s --timeout=5s --start-period=3s CMD ["curl", "-fsS", "-o", "/dev/null", "http://localhost:3000/health"]

ENTRYPOINT [ ]
CMD ["/app/cli.js"]
