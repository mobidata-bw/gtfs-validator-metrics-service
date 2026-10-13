import {mkdtemp, readFile} from 'node:fs/promises'
import {execa} from 'execa'
import {join as pathJoin} from 'node:path'

const executeGtfsValidator = (gtfsValidatorArgs, opt = {}) => {
	const {
		cancelSignal,
	} = {
		cancelSignal: null,
		...opt,
	}
	const pathToGtfsValidator = opt.pathToGtfsValidator ?? '/opt/gtfs-analyzer'

	return execa(pathToGtfsValidator, gtfsValidatorArgs, {
		...(cancelSignal ? {cancelSignal} : {}),
	})
}

const runGtfsValidator = async (gtfsUrl, gtfsPath, opt = {}) => {
	const {
		countryCode,
	} = {
		countryCode: null,
		...opt,
	}

	let gtfsArgs
	if (gtfsUrl) {
		throw new Error('passing a URL is not supported (anymore)')
	} else if (gtfsPath) {
		gtfsArgs = [gtfsPath]
	} else {
		throw new Error('either gtfsUrl or gtfsPath must not be null')
	}

	const outDir = await mkdtemp('/tmp/gtfs-validation-')
	const outPath = pathJoin(outDir, 'report.json')
	const gtfsValidatorArgs = [
		'validate',
		'--fail-on', 'critical', // "Exit 1 only when a notice in one of these rule classes exists [possible values: spec, interop, quality, analytics]"
		'--compact-json', // "Emit the canonical compact JSON projection for machine consumers"
		'-o', outPath,
		...gtfsArgs,
	]

	if (countryCode !== null) {
		gtfsValidatorArgs.push('-c', countryCode)
	}

	await executeGtfsValidator(gtfsValidatorArgs, opt)

	const report = JSON.parse(await readFile(outPath, {encoding: 'utf8'}))
	return {
		report,
	}
}

export {
	executeGtfsValidator,
	runGtfsValidator,
}
