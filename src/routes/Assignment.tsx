import { useParams } from '@solidjs/router'
import { createMemo, createSignal, createUniqueId, ErrorBoundary, For, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { Assignment, AssignmentNotFoundError, LOCAL_STORAGE_PREFIX_PASSED_ASSIGNMENT, type Pass, USER_ID } from '../types.tsx'

export default () => {
	const params = useParams()
	const [result, setResult] = createSignal()
	const [ticks, setTicks] = createSignal<number[]>([])
	const [passed, setPassed] = createSignal<Pass>('no')
	const [codeCellsWidth, setCodeCellsWidth] = createSignal(0)
	const assignment = createMemo(() => {
		const assignmentKey = params.path?.split('/').at(-1) ?? ''
		const assignment = Assignment.getAssignment(assignmentKey)
		const passedAssignment = localStorage.getItem(`${LOCAL_STORAGE_PREFIX_PASSED_ASSIGNMENT}${assignment.hashKey}`)
		if (passedAssignment) {
			const passedAssignmentSegments = JSON.parse(passedAssignment)
			passedAssignmentSegments.code.forEach((segment: string, index: number) => {
				assignment.segments[index * 2 + 1].set(segment)
			})
			setTicks(passedAssignmentSegments.ticks)
			setResult(passedAssignmentSegments.result)
			setPassed('yes')
		} else {
			setTicks(assignment.segments.map(() => -1))
		}
		return assignment
	})
	function error(err: Error) {
		switch (err.constructor) {
			case AssignmentNotFoundError:
				return (
					<div class='error-box'>
						<p>Could not find this assignment.</p>
						<A href='/'>Go back to Home</A>
					</div>
				)
			default:
				return (
					<div class='error-box'>
						<p>Something went wrong.</p>
						<A href='/'>Go back to Home</A>
					</div>
				)
		}
	}
	function updateCodeCells() {
		setCodeCellsWidth(Math.max(...[...document.getElementsByClassName('code-cell-input')].map((e) => e.scrollWidth)))
		const codeCells = [...document.getElementsByClassName('code-cell')] as HTMLElement[]
		const tickCells = [...document.getElementsByClassName('tick-cell')] as HTMLElement[]
		codeCells.forEach((codeCell, index) => {
			const tickCell = tickCells[index + 1]
			if (!tickCell) return
			codeCell.style.height = ''
			tickCell.style.height = ''
			if (index === 0 && codeCell.parentElement) {
				codeCell.parentElement.style.marginTop = `${tickCell.clientHeight}px`
			}
			tickCell.style.height = `${codeCell.clientHeight}px`
		})
	}
	setTimeout(updateCodeCells)
	async function validate(value: string, set: (value: string) => void) {
		set(value)
		updateCodeCells()
		const a = assignment()
		if (!a) return
		const v = await a.validate()
		setResult(v.error || v.result)
		setTicks(v.ticks)
		setPassed(v.passed)
		if (v.passed === 'yes') {
			const userTicks = ticks().filter((_t, index) => index % 2).reduce((a, b) => a + b, 0)
			const allTicks = ticks().reduce((a, b) => a + b, 0)
			fetch(`https://docs.google.com/forms/d/e/1FAIpQLSf8sJDTIXh8UXZzQUVkVBDMayUCrTg4fThHBJg2JNqn37dxyg/formResponse?entry.377919147=${USER_ID}&entry.850045796=${a.id.id}&entry.1964957096=${userTicks}&entry.1220465795=${allTicks}&submit=Submit`, {
				method: 'GET',
				mode: 'no-cors',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			})
			localStorage.setItem(
				`${LOCAL_STORAGE_PREFIX_PASSED_ASSIGNMENT}${a.hashKey}`,
				JSON.stringify({
					code: a.segments.filter((_s, index) => index % 2).map((s) => s.get()),
					ticks: v.ticks,
					result: v.result,
				}),
			)
		}
	}
	return (
		<div class='assignment-page'>
			<ErrorBoundary fallback={error}>
				<h1>{assignment()?.title}</h1>
				<div class='assignment-meta'>
					<span>
						Time: {ticks().filter((t, index) => index % 2 && 0 < t).reduce((a, b) => a + b, 0)} ticks
					</span>
					<span>
						Total: {ticks().filter((t) => 0 < t).reduce((a, b) => a + b, 0)} ticks
					</span>
				</div>
				<ErrorBoundary fallback={error}>
					<div class='code-grid'>
						<div class='code-cells'>
							<For each={[...assignment()?.segments]}>
								{(segment, index) => (
									<div class='code-cell'>
										<textarea
											id={createUniqueId()}
											class='code-cell-input'
											style={{ width: `${codeCellsWidth()}px` }}
											wrap='off'
											rows={segment?.get().split('\n').length}
											disabled={index() % 2 === 0}
											value={segment.get()}
											onInput={(e) => validate(e.target.value, segment.set)}
											spellcheck={false}
										/>
									</div>
								)}
							</For>
						</div>
						<div class='tick-cells'>
							<div class='tick-cell'>Ticks</div>
							<For each={ticks()}>
								{(tick) => (
									<Show when={0 <= tick}>
										<div class='tick-cell'>
											{tick}
										</div>
									</Show>
								)}
							</For>
						</div>
					</div>
					<div class='result-area' classList={{ success: passed() === 'yes', partial: passed() === 'partial' }}>
						<p style='margin: 0;'>
							<Show when={passed() === 'yes'}>
								<span aria-hidden='true'>✅</span> Passed —{' '}
							</Show>
							<Show when={passed() === 'partial'}>
								<span aria-hidden='true'>🟡</span> Partial pass, answer is not generic —{' '}
							</Show>
							Result:<output style='display: inline-flex; margin-left: 0.55em; white-space: pre-wrap;'>{result()?.toString()}</output>
						</p>
					</div>
					<Show when={passed() === 'yes'}>
						<div class='assignment-actions'>
							<A href='/' class='btn btn-primary'>Back to Home</A>
						</div>
					</Show>
				</ErrorBoundary>
			</ErrorBoundary>
		</div>
	)
}
