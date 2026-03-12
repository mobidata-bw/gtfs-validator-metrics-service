# syntax=docker/dockerfile:1

FROM ghcr.io/mobilitydata/gtfs-validator:7.1.0@sha256:1eefdbb5d25cbf478a137179a5ecf2681e78521384dc051994f8c33bb09d158e

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	apt-get update && apt-get --no-install-recommends install -y \
	nodejs npm

ADD package.json ./
RUN npm install --omit dev && npm cache clean --force

ADD . .

CMD ["/app/cli.js"]
