import {mkdtemp, readFile} from 'node:fs/promises'
import {cpus as osCpus} from 'node:os'
import {execa, ExecaError} from 'execa'
import {join as pathJoin} from 'node:path'
import fastify from 'fastify'
import fastifyAcceptsPlugin from '@fastify/accepts'
import {randomUUID} from 'node:crypto'
import pkg from './package.json' with {type: 'json'}

const executeGtfsValidator = (gtfsValidatorArgs, opt = {}) => {
	const {
		cancelSignal,
		pathToGtfsValidator,
	} = {
		cancelSignal: null,
		pathToGtfsValidator: '/opt/gtfs-validator-cli.jar',
		...opt,
	}

	return execa('java', [
		'-jar', pathToGtfsValidator,
		...gtfsValidatorArgs,
	], {
		...(cancelSignal ? {cancelSignal} : {}),
	})
}

const runGtfsValidator = async (gtfsUrl, opt = {}) => {
	const {
		countryCode,
	} = {
		countryCode: null,
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

	await executeGtfsValidator(gtfsValidatorArgs, opt)

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

const runValidationHttpApi = async (cfg, opt = {}) => {
	const {
		port,
		abortSignal,
	} = cfg
	const {
		host,
		getricsPrefix,
		logLevel,
		serverHeader,
	} = {
		host: 'localhost',
		getricsPrefix: 'gtfs_',
		logLevel: 'info',
		serverHeader: `${pkg.name} v${pkg.version}`,
		...opt,
	}

	const api = fastify({
		logger: {
			level: logLevel,
		},
		genReqId: randomUUID,
	})

	api.register(fastifyAcceptsPlugin)

	{
		api.get('/health', async (request, reply) => {
			reply.header('server', serverHeader)

			try {
				await executeGtfsValidator(['--help'])
				reply.status(200).send('ok')
			} catch (err) {
				if (err instanceof ExecaError) {
					request.log.warn({
						err,
					}, 'failed to run GTFS Validator with --help')
					reply.status(500).send('not ok')
				} else {
					throw err
				}
			}
		})
	}

	{
		const schema = {
			query: {
				type: 'object',
				required: [
					'target',
				],
				properties: {
					target: {
						type: 'string',
						format: 'url',
					},
					country_code: {
						type: 'string',
					},
				},
			},
		}

		// see also https://prometheus.io/docs/instrumenting/content_negotiation/#protocol-headers
		const responseMimeType = 'application/openmetrics-text; version=1.0.0; charset=utf-8'

		api.get('/probe', {schema}, async (request, reply) => {
			reply.header('server', serverHeader)

			// todo: use fastify-native content negotiation once supported: https://github.com/fastify/fastify/issues/4341
			reply.header('Accept', responseMimeType)
			if (request.accepts().type([responseMimeType]) !== responseMimeType) {
				reply.code(406)
				reply.send({
					message: `${responseMimeType} is the only supported metrics Content-Type`,
					statusCode: 406,
				})
				return;
			}

			const {
				target: gtfsUrl,
				country_code: countryCode = null,
			} = request.query

			const {
				systemErrors,
				report,
			} = await runGtfsValidator(gtfsUrl, {
				countryCode,
				cancelSignal: request.signal,
			})
			request.log.debug({
				systemErrors,
				reportSummary: report.summary,
			}, 'GTFS validation finished')
			request.log.trace({
				report,
			}, 'full GTFS validation report')

			const metrics = formatGtfsValidatorReportAsMetrics(report, {
				metricsPrefix: getricsPrefix,
			})
			reply.type(responseMimeType)
			reply.send(metrics)
		})
	}

	await api.listen({
		port,
		host,
	})
	abortSignal.onabort = () => {
		api.close()
	}
}

export {
	runGtfsValidator,
	formatGtfsValidatorReportAsMetrics,
	runValidationHttpApi,
}
