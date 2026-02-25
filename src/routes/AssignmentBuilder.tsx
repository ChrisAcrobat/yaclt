import { createSignal, createUniqueId, For, type Signal } from 'solid-js'
import { useParams } from '@solidjs/router'
import { Assignment } from '../types.tsx'
import Evaluator from '../Evaluator.ts'

export default () => {
	const params = useParams()
	const assignmentId = params.assignmentId ?? crypto.randomUUID()

	const codes: Signal<string>[] = []
	const segmentsInputId = createUniqueId()
	const [segments, setSegments] = createSignal(1)
	const [code, setCode] = createSignal('')
	const [testResult, setTestResult] = createSignal('')
	if (params.assignmentId) {
		const assignment = Assignment.getAssignment(assignmentId)
		if (assignment) {
			setSegments(assignment.segments.length)
			setTimeout(() => {
				assignment.segments.forEach((segment, index) => {
					const element = document.getElementById('segment_' + index.toString()) as HTMLTextAreaElement
					if (element) {
						element.value = segment.get()
						updateCode(element)
					}
				})
			})
		}
	}

	function updateCode(element: HTMLTextAreaElement) {
		const value = JSON.stringify(element.value)
		const rows = value.split('\\n').length
		element.rows = rows + (element.clientWidth < element.scrollWidth ? 1 : 0)
		const index = parseInt(element.id.split('_').at(-1) ?? '0')
		if (codes[index]) {
			codes[index][1](value)
		} else {
			codes[index] = createSignal(value)
		}

		const codeList: string[] = []
		codes.forEach((code) => {
			codeList.push(code[0]())
		})
		setCode('[\n' + codeList.join(',\n') + '\n]')
	}

	function updateCodeFromTextarea(rawValue: string) {
		const value = JSON.parse(rawValue) as unknown as Array<string>
		setSegments(value.length)
		value.forEach((code, index) => {
			const element = document.getElementById('segment_' + index.toString()) as HTMLTextAreaElement
			if (element) {
				element.value = code
				updateCode(element)
			}
		})
	}

	async function run() {
		const result = await Evaluator.evaluate('JavaScript / TypeScript', codes.map((code) => JSON.parse(code[0]())), [])
		setTestResult(JSON.stringify(result, null, '\n'))
	}

	return (
		<div class='builder-page section-card'>
			<h1>Assignment Builder</h1>
			<div class='form-group'>
				<div class='label'>Assignment ID</div>
				<input type='text' value={assignmentId} readOnly />
			</div>
			<div class='form-group'>
				<div class='label'>Number of segments</div>
				<input id={segmentsInputId} type='number' min={1} value={segments()} onChange={(e) => setSegments(e.target.valueAsNumber)} />
			</div>
			<div class='form-group'>
				<div class='label'>Segment content</div>
				<div class='code-cells' style='display: flex; flex-direction: column;'>
					<For each={Array.from({ length: segments() })}>
						{(_, index) => (
							<textarea
								id={'segment_' + index().toString()}
								class='code-cell'
								wrap='off'
								onInput={(e) => updateCode(e.target)}
								placeholder={`Segment ${index() + 1}`}
							/>
						)}
					</For>
				</div>
				<div class='label'>Test</div>
				<div style='display: inline-block;'>
					<button type='button' style='margin-right: 0.5rem;' onclick={() => run()}>Test run</button>
					<output>{testResult()}</output>
				</div>
			</div>
			<div class='form-group'>
				<div class='label'>Generated code (JSON)</div>
				<textarea value={code()} onInput={(e) => updateCodeFromTextarea(e.target.value)} />
			</div>
		</div>
	)
}
