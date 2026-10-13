import sortBy from 'lodash/sortBy.js'

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

// (translated from gtfs-analyzer source code using DeepL):
// > CRITICAL + SPEC — error that definitively prevents the official GTFS spec from being published
// > INTEROP class — consumer/interop compatibility indicator (not a publication blocker)
// https://github.com/ttezer/gtfs-analyzer/blob/33cb087000821a5fb896850939776c23324eef72/crates/core/src/enums.rs#L191-L229
const getNoticeLabelFromReportItem = (item) => {
	if (item.labels.includes('blocker')) {
		return {
			severity: 'ERROR',
			severityScore: 0,
		}
	}
	if (item.labels.includes('interop')) {
		return {
			severity: 'WARNING',
			severityScore: 1,
		}
	}
	if (item.labels.includes('quality')) {
		return {
			severity: 'INFO',
			severityScore: 2,
		}
	}
	return {
		severity: 'WARNING',
		severityScore: 1,
	}
}

const formatGtfsValidatorReportAsMetrics = (report, opt = {}) => {
	const {
		metricsPrefix,
	} = {
		metricsPrefix: 'gtfs_',
		...opt,
	}

	return [
		// > [_info] for a pseudo-metric that provides metadata about the running binary
		// todo [breaking]: add `_info` suffix
		_formatMetricFamily(
			`${metricsPrefix}validator_version`,
			'gauge',
			null,
			'version of the GTFS validator used',
			[
				[
					{
						v: report.engine_version,
					},
					1,
				],
			],
		),
		// > [_info] for a pseudo-metric that provides metadata about the running binary
		// todo [breaking]: add `_info` suffix
		_formatMetricFamily(
			`${metricsPrefix}validator_language`,
			'gauge',
			null,
			'language code used for the GTFS validation',
			[
				[
					{
						code: report.analysis.lang,
					},
					1,
				],
			],
		),
		// todo: not supported yet by gtfs-analyzer
		// _formatMetricFamily(
		// 	`${metricsPrefix}validated_at`,
		// 	'counter',
		// 	'seconds',
		// 	'when the GTFS validation finished',
		// 	[
		// 		[
		// 			{},
		// 			Date.parse(report.summary.validatedAt) / 1000 | 0,
		// 		],
		// 	],
		// ),
		// todo: not supported yet by gtfs-analyzer
		// _formatMetricFamily(
		// 	`${metricsPrefix}validation_time`,
		// 	'counter',
		// 	'seconds',
		// 	'how long the the GTFS validation took',
		// 	[
		// 		[
		// 			{},
		// 			report.summary.validationTimeSeconds,
		// 		],
		// 	],
		// ),

		// > [_total] for a unit-less accumulating count
		// todo [breaking]: this is not accumulating -> remove `_total` suffix
		_formatMetricFamily(
			`${metricsPrefix}validator_files_total`,
			'gauge',
			null,
			'GTFS files read by the GTFS Validator',
			report.metrics.file_stats.map(stat => [{file: stat.name}, 1]),
		),
		// todo: not supported yet by gtfs-analyzer
		// // > [_total] for a unit-less accumulating count
		// // todo [breaking]: this is not accumulating -> remove `_total` suffix
		// _formatMetricFamily(
		// 	`${metricsPrefix}counts_total`,
		// 	'gauge',
		// 	null,
		// 	'number of entities in the GTFS dataset',
		// 	Array.from(Object.entries(report.summary.counts))
		// 		.map(([kind, count]) => [{kind}, count]),
		// ),
		// todo: not supported yet by gtfs-analyzer
		// _formatMetricFamily(
		// 	`${metricsPrefix}features`,
		// 	'gauge',
		// 	null,
		// 	'features used in the GTFS dataset',
		// 	report.summary.gtfsFeatures.map((feature) => [
		// 		{feature: feature.replace(/[^\w]/, '_').toLowerCase()},
		// 		1,
		// 	]),
		// ),

		// > [_total] for a unit-less accumulating count
		// todo [breaking]: this is not accumulating -> remove `_total` suffix
		_formatMetricFamily(
			`${metricsPrefix}notices_total`,
			'gauge',
			null,
			'number of notices generated, by severity',
			sortBy(
				report.reports.r9.items.map(item => {
					const {
						severity,
						severityScore,
					} = getNoticeLabelFromReportItem(item)
					const labels = {
						severity,
						code: item.rule_id,
					}
					Object.defineProperty(labels, 'severityScore', {value: severityScore})
					return [
						labels,
						item.affected_instance_count,
					]
				}),
				['0.severityScore', '0.code'],
			),
		),

		// > Expositions MUST end with `EOF` and SHOULD end with `EOF\n`.
		// – https://prometheus.io/docs/specs/om/open_metrics_spec/#text-format
		'# EOF\n',
	].join('')
}

export {
	formatGtfsValidatorReportAsMetrics,
}
