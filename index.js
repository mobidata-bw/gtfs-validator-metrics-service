import {ExecaError} from 'execa'
import fastify from 'fastify'
import fastifyAcceptsPlugin from '@fastify/accepts'
import {randomUUID} from 'node:crypto'
import pkg from './package.json' with {type: 'json'}
import {
	executeGtfsValidator,
	runGtfsValidator,
} from './lib/run-validator.js'
import {formatGtfsValidatorReportAsMetrics} from './lib/format-report-as-metrics.js'

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

			const gtfsValidatorOpts = {
				countryCode,
				cancelSignal: request.signal,
			}
			request.log.debug({
				gtfsUrl,
				opts: gtfsValidatorOpts,
			}, 'running GTFS Validator')
			const {
				systemErrors,
				report,
			} = await runGtfsValidator(gtfsUrl, null, gtfsValidatorOpts)
			request.log.info({
				gtfsUrl,
				opts: gtfsValidatorOpts,
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
