#!/usr/bin/env node

import {parseArgs} from 'node:util'
import pkg from './package.json' with {type: 'json'}
import {runGtfsValidator} from './lib/run-validator.js'
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
		'country-code': {
			type: 'string',
			short: 'c',
		},
		'validator': {
			type: 'string',
			short: 'V',
		},
	},
	allowPositionals: true,
})

if (flags.help) {
	process.stdout.write(`
Usage:
    validate-gtfs-and-print-metrics <url-or-path-to-gtfs>
Options:
    --country-code     -o  Country code to use for validation.
    --validator        -V  Path to the GTFS Validator executable.
                             Default: /opt/gtfs-analyzer
Examples:
    validate-gtfs-and-print-metrics -c DE path/to/gtfs.zip
\n`)
	process.exit(0)
}

if (flags.version) {
	process.stdout.write(`${pkg.name} v${pkg.version}\n`)
	process.exit(0)
}

let gtfsUrl = null
let gtfsPath = null
try {
	gtfsUrl = new URL(args[0]).href
} catch (err) {
	if (err.code === 'ERR_INVALID_URL') {
		gtfsPath = args[0]
	} else {
		throw err
	}
}

const opt = {}
if (flags['country-code']) {
	opt.countryCode = flags['country-code']
}
if (flags['validator']) {
	opt.pathToGtfsValidator = flags['validator'] || null
}

const {
	// systemErrors,
	report,
} = await runGtfsValidator(gtfsUrl, gtfsPath, opt)

const metrics = formatGtfsValidatorReportAsMetrics(report)

process.stdout.write(metrics)
