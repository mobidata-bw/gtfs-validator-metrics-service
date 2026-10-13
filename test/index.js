import {join as pathJoin} from 'node:path'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {strictEqual} from 'node:assert/strict'
// import {runValidationHttpApi} from '../index.js'
import {
	formatGtfsValidatorReportAsMetrics,
} from '../lib/format-report-as-metrics.js'

import reportVbb20261008 from './vbb-2026-10-08.report.json' with {type: 'json'}
// > Text modules are available behind the --experimental-import-text flag.
// https://nodejs.org/docs/latest-v24.x/api/esm.html#text-modules
// import metricsVbb20261008 from './vbb-2026-10-08.metrics.txt' with {type: 'text'}
const metricsVbb20261008 = readFileSync(pathJoin(import.meta.dirname, 'vbb-2026-10-08.metrics.txt'), {encoding: 'utf8'})

// const port = process.env.PORT
// 	? parseInt(process.env.PORT)
// 	: 3000
// ok(Number.isInteger(port), '$PORT must be an integer')

// const abortController = new AbortController()
// const stopService = () => {
// 	abortController.abort('received SIGINT')
// }
// process.once('SIGINT', stopService)
// process.once('SIGTERM', stopService)

// const opt = {}

// if (process.env.HTTP_LISTEN_HOST) {
// 	opt.host = process.env.HTTP_LISTEN_HOST
// }

// if (process.env.GTFS_METRICS_PREFIX) {
// 	opt.gtfsMetricsPrefix = process.env.GTFS_METRICS_PREFIX
// }

// if (process.env.LOG_LEVEL) {
// 	opt.logLevel = process.env.LOG_LEVEL
// }

// if (process.env.HTTP_SERVER_HEADER) {
// 	opt.serverHeader = process.env.HTTP_SERVER_HEADER
// }

// await runValidationHttpApi({
// 	port,
// 	abortSignal: abortController.signal,
// }, opt)

// {
// 	let api
// 	try {
// 		api = await runValidationHttpApi({
// 			port: 20000 + Math.floor(Math.random() * 10000),
// 		})

// 		// todo
// 		// todo: fails with non-URL `target` query param
// 		// todo: cancelling the request kills the validator process
// 	} finally {
// 		await api.close()
// 	}
// }

test('correctly formats JSON report as metrics', () => {
	const actualMetrics = formatGtfsValidatorReportAsMetrics(reportVbb20261008)
	strictEqual(actualMetrics, metricsVbb20261008)
})
