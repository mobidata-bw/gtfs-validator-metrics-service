import {mkdtemp, readFile} from 'node:fs/promises'
import {cpus as osCpus} from 'node:os'
import {execa} from 'execa'
import {join as pathJoin} from 'node:path'

const runGtfsValidator = async (gtfsUrl, opt = {}) => {
	const {
		countryCode,
		cancelSignal,
		pathToGtfsValidator,
	} = {
		countryCode: null,
		cancelSignal: null,
		pathToGtfsValidator: '/gtfs-validator-cli.jar',
		...opt,
	}

	const outDir = await mkdtemp('/tmp/gtfs-validation-')
	// todo: allow setting custom User-Agent once supported: https://github.com/MobilityData/gtfs-validator/issues/2138
	const gtfsValidatorArgs = [
		'-o', outDir,
		'-svu', // "Skips check for new validator version"
		'-t', String(osCpus().length),
		'-u', gtfsUrl,
	]

	if (countryCode !== null) {
		gtfsValidatorArgs.push('-c', countryCode)
	}

	await execa('java', [
		'-jar', pathToGtfsValidator,
		...gtfsValidatorArgs,
	], {
		...(cancelSignal ? {cancelSignal} : {}),
	})

	const systemErrors = JSON.parse(await readFile(pathJoin(outDir, 'system_errors.json'), {encoding: 'utf8'}))
	const report = JSON.parse(await readFile(pathJoin(outDir, 'report.json'), {encoding: 'utf8'}))
	return {
		systemErrors,
		report,
	}
}

// roughly follows the OpenMetrics 1.0 exposition text format
// see also https://prometheus.io/docs/specs/om/open_metrics_spec/
const _formatMetricFamily = (name, type, unit, help, metrics) => {
	// Adding the unit as a suffix is a best practice.
	if (unit !== null) {
		name += `_${unit}`
	}
	let out = ''

	// generate metadata lines
	out += `# TYPE ${name} ${type}\n`
	if (unit !== null) {
		out += `# UNIT ${name} ${unit}\n`
	}
	out += `# HELP ${name} ${help}\n`

	// generate metrics lines
	// todo: escape `"` in value
	const formatLabel = ([name, val]) => `${name}="${val}"`
	for (let [labels, val] of metrics) {
		out += name
		labels = Object.entries(labels)
		// only metrics with labels need the `{…}` notation
		if (labels.length > 0) {
			out += `{${labels.map(formatLabel).join(',')}}`
		}
		out += ` ${val}\n`
	}

	return out
}

const formatGtfsValidatorReportAsMetrics = (report, opt = {}) => {
	const {
		metricsPrefix,
	} = {
		metricsPrefix: 'gtfs_',
		...opt,
	}

	return [
		_formatMetricFamily(
			`${metricsPrefix}validator_version`,
			'gauge',
			null,
			'version of the GTFS Validator used',
			[
				[
					{
						v: report.summary.validatorVersion,
					},
					1,
				],
			],
		),
		_formatMetricFamily(
			`${metricsPrefix}validator_country`,
			'gauge',
			null,
			'country code used for the GTFS validation',
			[
				[
					{
						cc: report.summary.countryCode,
					},
					1,
				],
			],
		),
		_formatMetricFamily(
			`${metricsPrefix}validated_at`,
			'counter',
			'seconds',
			'when the GTFS validation finished',
			[
				[
					{},
					Date.parse(report.summary.validatedAt) / 1000 | 0,
				],
			],
		),
		_formatMetricFamily(
			`${metricsPrefix}validation_time`,
			'counter',
			'seconds',
			'how long the the GTFS validation took',
			[
				[
					{},
					report.summary.validationTimeSeconds,
				],
			],
		),

		_formatMetricFamily(
			`${metricsPrefix}validator_files_total`,
			'gauge',
			null,
			'GTFS files read by the GTFS Validator',
			report.summary.files.map(file => [{file}, 1]),
		),
		_formatMetricFamily(
			`${metricsPrefix}counts_total`,
			'gauge',
			null,
			'number of entities in the GTFS dataset',
			Array.from(Object.entries(report.summary.counts))
				.map(([kind, count]) => [{kind}, count]),
		),
		_formatMetricFamily(
			`${metricsPrefix}features`,
			'gauge',
			null,
			'features used in the GTFS dataset',
			report.summary.gtfsFeatures.map((feature) => [
				{feature: feature.replace(/[^\w]/, '_').toLowerCase()},
				1,
			]),
		),

		_formatMetricFamily(
			`${metricsPrefix}notices_total`,
			'gauge',
			null,
			'number of notices generated, by severity',
			report.notices.map(({code, severity, totalNotices}) => [
				{severity, code},
				totalNotices,
			]),
		),
		// > Expositions MUST end with `EOF` and SHOULD end with `EOF\n`.
		// – https://prometheus.io/docs/specs/om/open_metrics_spec/#text-format
		'# EOF\n',
	].join('')
}

// todo

export {
	runGtfsValidator,
	formatGtfsValidatorReportAsMetrics,
	// todo
}
