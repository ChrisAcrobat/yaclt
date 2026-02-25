import { createStore } from 'solid-js/store'
import { createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'
import Evaluator from './Evaluator.ts'

export const LOCAL_STORAGE_PREFIX_PASSED_ASSIGNMENT = 'passed_assignment_:'
export const PASSED_ASSIGNMENTS_BEFORE_CURRENT_SESSION: Assignment[] = []
export type Language = 'JavaScript / TypeScript'
export type Pass = 'no' | 'partial' | 'yes'

export const USER_ID = localStorage.getItem('USER_ID') ?? crypto.randomUUID()
localStorage.setItem('USER_ID', USER_ID)
fetch(`https://docs.google.com/forms/d/e/1FAIpQLSdefkSHYqvtUU2r-Yv-co-izV2bRvwNqGX138fjLiO-vaP-Yw/formResponse?entry.2045721106=${USER_ID}&submit=Submit`, {
	method: 'GET',
	mode: 'no-cors',
	headers: {
		'Content-Type': 'application/x-www-form-urlencoded',
	},
})

class UniqueID {
	static #unique: string[] = []

	private _id: string
	get id() {
		return this._id
	}

	constructor(id: string) {
		if (UniqueID.#unique.includes(id)) {
			throw new Error('ID already exists')
		}
		UniqueID.#unique.push(id)
		this._id = id
	}

	toString() {
		return this._id
	}
}

export class AssignmentNotFoundError extends Error {
	constructor(key: string) {
		super(`Assignment not found: ${key}`)
	}
}

const labels: Label[] = []
export class Label {
	#_name: string
	#_prerequisites: Label[]
	get name() {
		return this.#_name
	}
	get isUnlocked() {
		const prerequisite = flatAssignments.find((assignment) => this.#_prerequisites.includes(assignment.label) && !assignment.passed)
		return !prerequisite
	}
	static getByName(name: string) {
		return labels.find((label) => label.name === name)
	}
	static getSortNumber(name: string) {
		return labels.findIndex((label) => label.name === name)
	}
	constructor(name: string, prerequisites: Label[]) {
		this.#_name = name
		this.#_prerequisites = prerequisites
		labels.push(this)
	}
}

const [assignments, setAssignments] = createStore<Record<Language, Record<string, Assignment[]>>>({
	'JavaScript / TypeScript': {},
})
const flatAssignments: Assignment[] = []
export class Assignment {
	#_id: UniqueID
	#_title: string
	#_label: Label
	#_language: Language
	#_segments: {
		get: Accessor<string>
		set: (value: string) => void
	}[]
	#_inputs: string[][]
	#_answers: (number | string | boolean | null | object)[]
	#_hashKey: string = ''
	#_passed: Pass = 'no'
	get hashKey(): string {
		if (!this.#_hashKey) {
			throw new Error('Hash key not set')
		}
		return this.#_hashKey
	}
	set hashKey(hashKey: string) {
		if (this.#_hashKey) {
			throw new Error('Hash key already set')
		}
		this.#_hashKey = hashKey
		this.#_passed = localStorage.getItem(`${LOCAL_STORAGE_PREFIX_PASSED_ASSIGNMENT}${this.#_hashKey}`) !== null ? 'yes' : 'no'
	}
	get id() {
		return this.#_id
	}
	get title() {
		return this.#_title
	}
	get label() {
		return this.#_label
	}
	get language() {
		return this.#_language
	}
	get segments() {
		return this.#_segments
	}
	get passed() {
		return this.#_passed
	}
	async validate() {
		let result: unknown = undefined
		let ticks: number[] = []
		let error: unknown = undefined
		const passed: boolean[] = []
		const promises: Promise<void>[] = []
		this.#_inputs.forEach((inputs, index) => {
			promises.push(
				Promise.resolve().then(async () => {
					const answer = this.#_answers[index]
					const { result: res, ticks: tic, error: err } = await Evaluator.evaluate(this.#_language, this.#_segments.map((segment) => segment.get()), inputs)
					if (res === undefined) {
						passed.push(false)
					} else if (![typeof answer, typeof res].find((type) => type !== 'object')) {
						passed.push(JSON.stringify(answer) === JSON.stringify(res))
					} else {
						passed.push(answer === res)
					}
					if (index === 0) {
						result = res
						ticks = tic
					}
					if (!error) {
						error = err
					}
				}),
			)
		})
		await Promise.all(promises)
		this.#_passed = passed.every((p) => p) ? 'yes' : passed.some((p) => p) ? 'partial' : 'no'
		return { result, passed: this.#_passed, ticks, error }
	}

	static get assignments() {
		return assignments
	}
	static getAssignment(key: string) {
		const assignment = flatAssignments.find((assignment) => assignment.id.id === key)
		if (!assignment) {
			throw new AssignmentNotFoundError(key)
		}
		return assignment
	}
	static flat() {
		return [...flatAssignments]
	}

	constructor(
		language: Language,
		label: Label,
		data: {
			id: string
			title: string
			segments: string[]
			inputs: string[][]
			answers: (number | string | boolean | null | object)[]
		},
	) {
		if (
			!data.id.match(
				/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
			)
		) {
			throw new Error('Key is not a valid UUID')
		}
		if (data.segments.length < 2) {
			throw new Error('All assignments must at least have one segment to setup the assignment with optional inputs and then one for the user to write the code to solve the assignment.')
		}
		if (data.inputs.length !== data.answers.length) {
			throw new Error('All assignments must have the same number of inputs and answers')
		}
		this.#_id = new UniqueID(data.id)
		this.#_title = data.title
		this.#_label = label
		this.#_language = language
		this.#_inputs = data.inputs
		this.#_answers = data.answers
		this.#_segments = []
		data.segments.forEach((segment, index) => {
			const [segmentSignal, setSegmentSignal] = createSignal(segment)
			const s: {
				get: Accessor<string>
				set: (value: string) => void
			} = {
				get: () => segmentSignal(),
				set: (value) => {
					if (index % 2 === 0) {
						throw new Error('Cannot set a read-only segment')
					}
					setSegmentSignal(value)
				},
			}
			this.#_segments.push(s)
		})
		flatAssignments.push(this)
		setAssignments((store) => {
			if (!store[language][label.name]) {
				store[language][label.name] = []
			}
			store[language][label.name].push(this)
			return store
		})
	}
}
