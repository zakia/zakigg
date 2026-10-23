import * as v from 'valibot';

export const confidenceSchema = v.strictObject({
	method: v.optional(v.picklist(['similarity', 'classifier'])),
	score: v.pipe(v.number(), v.finite(), v.minValue(-1), v.maxValue(1)),
	margin: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(2))
});
export type ClassificationConfidence = v.InferOutput<typeof confidenceSchema>;
/** Similarity and separation are heuristics, not calibrated accuracy probabilities. */
export function confidenceLevel(
	value?: ClassificationConfidence
): 'high' | 'medium' | 'low' | null {
	if (!value) return null;
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
	return scored.length === values.length && scored.length
		? {
				...(scored.every((value) => value.method === 'classifier')
					? { method: 'classifier' as const }
					: {}),
				score: Math.min(...scored.map((value) => value.score)),
				margin: Math.min(...scored.map((value) => value.margin))
			}
		: undefined;
}
