import {join as pathJoin} from 'node:path'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {strictEqual} from 'node:assert/strict'
import {
	formatGtfsValidatorReportAsMetrics,
} from '../lib/format-report-as-metrics.js'

import reportVbb20261008 from './vbb-2026-10-08.report.json' with {type: 'json'}
// > Text modules are available behind the --experimental-import-text flag.
// https://nodejs.org/docs/latest-v24.x/api/esm.html#text-modules
// import metricsVbb20261008 from './vbb-2026-10-08.metrics.txt' with {type: 'text'}
const metricsVbb20261008 = readFileSync(pathJoin(import.meta.dirname, 'vbb-2026-10-08.metrics.txt'), {encoding: 'utf8'})

test('correctly formats JSON report as metrics', () => {
	const actualMetrics = formatGtfsValidatorReportAsMetrics(reportVbb20261008)
	strictEqual(actualMetrics, metricsVbb20261008)
})
