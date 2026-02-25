import { A, useNavigate } from '@solidjs/router'
import { type Accessor, createSignal, For, Show } from 'solid-js'
import { Assignment, Label, PASSED_ASSIGNMENTS_BEFORE_CURRENT_SESSION } from '../types.tsx'

function getPassedAssignments() {
	return Assignment.flat().filter((assignment) => assignment.passed === 'yes')
}
const passedAssignments = getPassedAssignments()
const passedAssignmentsSignals: Record<string, [Accessor<boolean>, (value: boolean) => void]> = {}
function passedAssignmentWatcher() {
	try {
		const newPassedAssignments = getPassedAssignments().filter((assignment) => !passedAssignments.includes(assignment))
		newPassedAssignments.forEach((assignment) => {
			if (passedAssignmentsSignals[assignment.hashKey]) {
				passedAssignmentsSignals[assignment.hashKey][1](true)
			}
		})
		passedAssignments.push(...newPassedAssignments)
	} catch (error) {
		console.error(error)
	}
	requestAnimationFrame(passedAssignmentWatcher)
}
passedAssignmentWatcher()

export default () => {
	if (location.hash.startsWith('#/')) {
		useNavigate()(location.hash.slice(1))
	}

	function init(todo: boolean) {
		const result: Record<string, Record<string, Assignment[]>> = {}
		Object.entries(Assignment.assignments).filter(([language, labels]) => {
			Object.keys(labels).forEach((label) => {
				labels[label].forEach((assignment) => {
					if (PASSED_ASSIGNMENTS_BEFORE_CURRENT_SESSION.includes(assignment) !== todo) {
						if (!result[language]) {
							result[language] = {}
						}
						if (!result[language][label]) {
							result[language][label] = []
						}
						result[language][label].push(assignment)
					}
				})
			})
		})
		return Object.entries(result)
	}

	function passed(assignment: Assignment) {
		if (passedAssignmentsSignals[assignment.hashKey]) {
			return passedAssignmentsSignals[assignment.hashKey][0]
		}
		const [passed, setPassed] = createSignal(passedAssignments.includes(assignment))
		passedAssignmentsSignals[assignment.hashKey] = [passed, setPassed]
		return passed
	}
	function formatUrl(assignment: Assignment) {
		return `${replace(assignment.language)}/${replace(assignment.label.name)}/${replace(assignment.title)}/${assignment.id}`
	}
	function replace(text: string) {
		return text.replaceAll(' / ', '-').replaceAll(' ', '_')
	}
	return (
		<div class='home-layout'>
			<For each={[true, false]}>
				{(todo) => (
					<div class='section-card assignments-column'>
						<Show when={todo}>
							<h1>Assignments</h1>
						</Show>
						<Show when={!todo}>
							<h1>Passed Assignments</h1>
						</Show>
						<For each={init(todo)}>
							{([language, labels]) => (
								<section class='language-section' aria-label={language}>
									<h2>{language}</h2>
									<ol class='label-list' classList={{ reverse: todo }}>
										<For each={Object.entries(labels).sort((a, b) => Label.getSortNumber(a[0]) - Label.getSortNumber(b[0]))}>
											{([label, assignments]) => (
												<Show when={Label.getByName(label)?.isUnlocked}>
													<li classList={{ reverse: todo }}>
														<h3>{label}</h3>
														<ol class='assignment-list'>
															<For each={assignments}>
																{(assignment) => (
																	<li classList={{ passed: passed(assignment)() }}>
																		<A href={`/Assignment/${formatUrl(assignment)}`}>{assignment.title}</A>
																	</li>
																)}
															</For>
														</ol>
													</li>
												</Show>
											)}
										</For>
									</ol>
								</section>
							)}
						</For>
					</div>
				)}
			</For>
		</div>
	)
}
