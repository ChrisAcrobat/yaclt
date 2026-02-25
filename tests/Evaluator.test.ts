import Evaluator from '../src/Evaluator.ts'
import { assertEquals } from 'jsr:@std/assert@1.0.18'

Deno.test('Evaluator', async () => {
	const result = await Evaluator.evaluate('JavaScript / TypeScript', ['true'], [])
	assertEquals(result.result, true)
})
