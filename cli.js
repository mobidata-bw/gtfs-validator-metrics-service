#!/usr/bin/env node

// todo [breaking]: rename to run-validation-http-api.js

import {ok} from 'node:assert/strict'
import {runValidationHttpApi} from './index.js'

const port = process.env.PORT
	? parseInt(process.env.PORT)
	: 3000
ok(Number.isInteger(port), '$PORT must be an integer')

const abortController = new AbortController()
const stopService = () => {
	abortController.abort('received SIGINT')
}
process.once('SIGINT', stopService)
process.once('SIGTERM', stopService)

const opt = {}

if (process.env.HTTP_LISTEN_HOST) {
	opt.host = process.env.HTTP_LISTEN_HOST
}

if (process.env.GTFS_METRICS_PREFIX) {
	opt.gtfsMetricsPrefix = process.env.GTFS_METRICS_PREFIX
}

if (process.env.LOG_LEVEL) {
	opt.logLevel = process.env.LOG_LEVEL
}

if (process.env.HTTP_SERVER_HEADER) {
	opt.serverHeader = process.env.HTTP_SERVER_HEADER
}

await runValidationHttpApi({
	port,
	abortSignal: abortController.signal,
}, opt)
