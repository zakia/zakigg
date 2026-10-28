import * as v from 'valibot';

const scoredConfidenceSchema = v.strictObject({
	method: v.optional(v.picklist(['similarity', 'classifier'])),
	score: v.pipe(v.number(), v.finite(), v.minValue(-1), v.maxValue(1)),
	margin: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(2))
});
export const confidenceSchema = v.union([
	scoredConfidenceSchema,
	v.strictObject({ method: v.literal('llm'), assessment: v.picklist(['clear', 'uncertain']) })
]);
export type ClassificationConfidence = v.InferOutput<typeof confidenceSchema>;
/** Similarity and separation are heuristics, not calibrated accuracy probabilities. */
export function confidenceLevel(
	value?: ClassificationConfidence
): 'high' | 'medium' | 'low' | null {
	if (!value) return null;
	if (value.method === 'llm') return value.assessment === 'clear' ? 'medium' : 'low';
	if (value.method === 'classifier') {
		if (value.score >= 0.8 && value.margin >= 0.2) return 'high';
		if (value.score >= 0.7 && value.margin >= 0.1) return 'medium';
		return 'low';
	}
	if (value.score >= 0.5 && value.margin >= 0.12) return 'high';
	if (value.score >= 0.28 && value.margin >= 0.05) return 'medium';
	return 'low';
}
export function weakestConfidence(values: (ClassificationConfidence | undefined)[]) {
	const scored = values.filter((value): value is ClassificationConfidence => !!value);
	if (!scored.length || scored.length !== values.length) return undefined;
	if (
		scored.some((value) => value.method === 'llm') &&
		scored.some((value) => value.method !== 'llm')
	) {
		return (
			scored.find((value) => confidenceLevel(value) === 'low') ??
			scored.find((value) => confidenceLevel(value) === 'medium') ??
			scored[0]
		);
	}
	if (scored[0].method === 'llm')
		return {
			method: 'llm' as const,
			assessment: scored.some((value) => value.method === 'llm' && value.assessment === 'uncertain')
				? ('uncertain' as const)
				: ('clear' as const)
		};
	const numeric = scored.filter((value) => value.method !== 'llm');
	return {
		...(numeric.every((value) => value.method === 'classifier')
			? { method: 'classifier' as const }
			: {}),
		score: Math.min(...numeric.map((value) => value.score)),
		margin: Math.min(...numeric.map((value) => value.margin))
	};
}
