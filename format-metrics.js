#!/usr/bin/env node

import {parseArgs} from 'node:util'
import {readFile} from 'node:fs/promises'
import pkg from './package.json' with {type: 'json'}
import {formatGtfsValidatorReportAsMetrics} from './lib/format-report-as-metrics.js'

const {
	values: flags,
	positionals: args,
} = parseArgs({
	options: {
		'help': {
			type: 'boolean',
			short: 'h',
		},
		'version': {
			type: 'boolean',
			short: 'v',
		},
	},
	allowPositionals: true,
})

if (flags.help) {
	process.stdout.write(`
Usage:
    format-metrics <path-to-validation-report>
Examples:
    format-metrics path/to/validation/report.json
\n`)
	process.exit(0)
}

if (flags.version) {
	process.stdout.write(`${pkg.name} v${pkg.version}\n`)
	process.exit(0)
}

const pathToReport = args[0]
const report = JSON.parse(await readFile(pathToReport))
const metrics = formatGtfsValidatorReportAsMetrics(report)

process.stdout.write(metrics)
