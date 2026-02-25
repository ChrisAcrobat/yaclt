/// <reference lib="webworker" />
import { Agent, CreateBuiltinFunction, CreateDataProperty, ManagedRealm, setSurroundingAgent, unwrapCompletion, Value } from '@magic-works/engine262'

type Result =
	| { Type: 'throw'; Value: { ErrorData: { value: Error } } }
	| { Type: 'normal'; Value: { value: unknown } }

setSurroundingAgent(
	new Agent({
		onNodeEvaluation() {
			tickCounter++
			if (thresholdChecker-- < 0) {
				throw new Error('Threshold exceeded')
			}
		},
	}),
)

function addJsonWrapper(script: string) {
	const lines = script.trim().split('\n')
	const lastLine = lines.pop()!
	const statements = lastLine.split(';')
	const response = statements.pop()!.replace(/\/\/.*/g, '').trimEnd()
	script = lines.join('\n') + statements.join(';')
	return script + `\nJSON.stringify(${response})`
}

function execute(script: string, inputs: string[]): Result {
	let result
	const realm = new ManagedRealm({})
	realm.scope(() => {
		unwrapCompletion(CreateDataProperty(
			realm.GlobalObject,
			Value('prompt'),
			CreateBuiltinFunction(
				() => {
					return Value(inputs.shift()!)
				},
				1,
				Value('prompt'),
				[],
			),
		))
		result = realm.evaluateScript(script)
	})
	return result as unknown as Result
}

let tickCounter = 0
let thresholdChecker = 0

function evaluate(script: string, inputs: string[], measureTicks = false, threshold = 1_000_000) {
	if (threshold <= 0) {
		throw new Error('Threshold must be greater than 0')
	}
	tickCounter = 0
	thresholdChecker = threshold
	const ticksAtStart = tickCounter

	if (!measureTicks) {
		script = addJsonWrapper(script)
	}

	let result
	let error
	try {
		const raw = execute(script, inputs)
		if (raw.Type === 'throw') {
			error = raw.Value.ErrorData.value
		} else if (!measureTicks) {
			result = JSON.parse(raw.Value.value as string)
		}
	} catch (err) {
		error = err
	}
	const ticks = tickCounter - ticksAtStart
	return { result, ticks, error }
}

onmessage = (event: MessageEvent) => {
	const { script, inputs } = event.data
	const { ticks, error: error1 } = evaluate(script, structuredClone(inputs), true)
	if (error1) {
		postMessage({ result: undefined, ticks, error: error1 })
		return
	}
	const { result, error: error2 } = evaluate(script, structuredClone(inputs), false)
	postMessage({ result, ticks, error: error1 || error2 })
}

postMessage(null)
