import type { ClassificationInput } from './local-ai-contract';

export type SetFitHead = {
	dimension: number;
	labels: { categoryId: string; name: string }[];
	weights: number[][];
	intercepts: number[];
};

/** Logistic head trained on the exported encoder's normalized vectors. No nearest-label search. */
export function classifySetFit(
	vector: readonly number[],
	head: SetFitHead,
	input: ClassificationInput
) {
	if (
		vector.length !== head.dimension ||
		vector.some((value) => !Number.isFinite(value)) ||
		head.weights.length !== head.labels.length ||
		head.intercepts.length !== head.labels.length ||
		head.weights.some((weights) => weights.length !== head.dimension)
	)
		throw new Error('The SetFit model and classifier head do not match.');
	const logits = head.weights.map((weights, i) =>
		weights.reduce((sum, value, j) => sum + value * vector[j], head.intercepts[i])
	);
	const max = Math.max(...logits),
		exp = logits.map((value) => Math.exp(value - max));
	const total = exp.reduce((sum, value) => sum + value, 0);
	const ranked = exp
		.map((value, i) => ({ score: value / total, label: head.labels[i] }))
		.sort((a, b) => b.score - a.score);
	const best = ranked[0];
	const confidence = {
		method: 'classifier' as const,
		score: best.score,
		margin: best.score - (ranked[1]?.score ?? 0)
	};
	const choice = input.categories.find((category) => category.id === best.label.categoryId);
	return {
		// Useful but weaker candidates remain visible for explicit review; the UI only
		// preselects scores >= 0.70. Near-uniform or tied predictions have no suggestion.
		c:
			choice && confidence.score >= 0.45 && confidence.margin >= 0.1 ? choice.name : input.fallback,
		confidence
	};
}
