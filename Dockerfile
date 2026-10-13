# syntax=docker/dockerfile:1

# todo: pin, keep up-to-date using renovate bot
FROM rust:1-alpine AS gtfs-analyzer

# todo: pin gtfs-analyzer version, keep up-to-date using renovate bot?
RUN \
	--mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
	cargo install gtfs-analyzer

FROM node:24-alpine

WORKDIR /app

# curl is needed for health checking
RUN --mount=type=cache,target=/var/log,sharing=locked \
	apk add --no-cache \
	curl

COPY --from=gtfs-analyzer /usr/local/cargo/bin/gtfs-analyzer /opt/gtfs-analyzer

ENV NODE_ENV=production
# Let Node.js listen not on `lo` (loopback interface) but on all interfaces, so that it is available non-locally.
ENV HTTP_LISTEN_HOST='0.0.0.0'

ADD package.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
	--mount=type=cache,target=/tmp/node-compile-cache,sharing=locked \
	npm install --omit dev && npm cache clean --force

ADD . .

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=3s CMD ["curl", "-fsS", "-o", "/dev/null", "http://localhost:3000/health"]

ENTRYPOINT [ ]
CMD ["/app/cli.js"]
