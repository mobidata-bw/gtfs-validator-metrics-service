import {mkdtemp, readFile} from 'node:fs/promises'
import {cpus as osCpus} from 'node:os'
import {execa} from 'execa'
import {join as pathJoin} from 'node:path'

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
		// todo: not supported yet?
		// '-XX:+UseCompactObjectHeaders',
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

export {
	runGtfsValidator,
}
