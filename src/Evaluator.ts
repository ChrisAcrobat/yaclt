import type { Language } from './types.tsx'

type WorkerResult = { result: unknown; ticks: number; error: unknown }
type Result = { result: unknown; ticks: number[]; error: unknown }

function getWorker(language: Language) {
	if (language !== 'JavaScript / TypeScript') {
		throw new Error('Unsupported language')
	}
	return new Worker(new URL('./workers/Engine262.ts', import.meta.url), { type: 'module' })
}
function execute(language: Language, script: string, inputs: string[]) {
	let resolve!: (data: WorkerResult) => void
	let reject!: (err: unknown) => void
	const promise = new Promise<WorkerResult>((res, rej) => {
		resolve = res
		reject = rej
	})
	const worker = getWorker(language)
	worker.onerror = (event) => {
		worker.terminate()
		reject(event.error ?? new Error('Worker failed to load'))
	}
	worker.onmessage = () => {
		worker.postMessage({ script, inputs })
		worker.onmessage = (event) => {
			worker.terminate()
			resolve(event.data)
		}
	}
	return promise
}

export default class {
	static evaluate(language: Language, script: string[], inputs: string[]): Promise<Result> {
		let mergedSegments: string = ''
		const promises: Promise<WorkerResult>[] = []
		script.forEach((segment) => {
			if (mergedSegments) {
				mergedSegments += '\n'
			}
			mergedSegments += segment
			promises.push(
				new Promise((resolve) => {
					execute(language, mergedSegments, inputs).then((res) => {
						resolve(res)
					})
				}),
			)
		})
		return Promise.all(promises).then((results: WorkerResult[]) => {
			const result: Result = {
				result: results.at(-1)?.result,
				ticks: [],
				error: results.at(-1)?.error,
			}
			results.forEach((r) => {
				result.ticks.push(r.ticks - result.ticks.reduce((a, b) => a + b, 0))
			})
			return result
		})
	}
}
