import * as v from 'valibot';
import { confidenceLevel } from './confidence';
import head from './setfit-head.json';

export const LOCAL_MODEL = 'SetFit merchant classifier';
export const MODEL_REPO = 'ledgerclean-setfit-v1';
export const MODEL_CACHE = `ledgerclean-local-ai-setfit-${head.encoderSha256.slice(0, 12)}`;
export const MODEL_DOWNLOAD_MB = 50;
// Reserve 10 MB for bundled JavaScript; model, tokenizer and WASM downloads share this limit.
export const ASSET_DOWNLOAD_LIMIT = 390_000_000;
const inputSchema = v.strictObject({
	fallback: v.string(),
	rules: v.optional(
		v.array(
			v.strictObject({
				keyword: v.string(),
				accountType: v.optional(v.picklist(['unknown', 'cash', 'credit'])),
				direction: v.optional(v.picklist(['in', 'out'])),
				category: v.string(),
				match: v.picklist(['exact', 'contains', 'merchant', 'regex']),
				field: v.picklist(['description', 'sourceCategory'])
			})
		),
		[]
	),
	guidance: v.optional(v.pipe(v.string(), v.maxLength(500))),
	categories: v.array(
		v.strictObject({ id: v.optional(v.string()), name: v.string(), purpose: v.string() })
	),
	examples: v.optional(v.array(v.strictObject({ d: v.string(), c: v.string() })), []),
	transactions: v.array(
		v.strictObject({
			t: v.pipe(v.number(), v.integer()),
			d: v.string(),
			bankCategory: v.optional(v.string()),
			accountType: v.optional(v.string()),
			activityType: v.optional(v.string()),
			direction: v.string(),
			currentCategory: v.optional(v.string())
		})
	)
});
export type ClassificationInput = v.InferOutput<typeof inputSchema>;
export function parseClassificationInput(input: unknown): ClassificationInput {
	const parsed = v.parse(inputSchema, input);
	if (!parsed.categories.some((item) => item.name === parsed.fallback))
		throw new Error('The review category must exist.');
	if (
		!parsed.categories.length ||
		new Set(parsed.categories.map((item) => item.name)).size !== parsed.categories.length
	)
		throw new Error('Categories must have unique names.');
	return parsed;
}
export function merchantText(
	input: ClassificationInput,
	row: ClassificationInput['transactions'][number]
) {
	return [row.d, row.bankCategory, input.guidance]
		.filter(Boolean)
		.join('. ')
		.toLowerCase()
		.replace(/\b\d+\b/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 600);
}
export type CategoryVector = { name: string; vector: readonly number[] };
/** Similarity is a ranking score, not a calibrated probability. Ambiguous results stay in review. */
export function rankCategory(
	query: readonly number[],
	prototypes: readonly CategoryVector[],
	fallback: string
) {
	const scores = new Map<string, number>();
	for (const { name, vector } of prototypes) {
		const score = vector.reduce((sum, value, i) => sum + value * query[i], 0);
		if (Number.isFinite(score)) scores.set(name, Math.max(scores.get(name) ?? -Infinity, score));
	}
	const ranked = [...scores].sort((a, b) => b[1] - a[1]);
	const best = ranked[0];
	const confidence = {
		score: Math.max(-1, Math.min(1, best?.[1] ?? 0)),
		margin: Math.max(0, Math.min(2, (best?.[1] ?? 0) - (ranked[1]?.[1] ?? 0)))
	};
	const suggestedCategory = best?.[0] ?? fallback;
	return {
		category: confidenceLevel(confidence) === 'low' ? fallback : suggestedCategory,
		suggestedCategory,
		confidence
	};
}
export function matchCategory(
	query: readonly number[],
	prototypes: readonly CategoryVector[],
	fallback: string
): string {
	return rankCategory(query, prototypes, fallback).category;
}
/** Only published static assets can be requested by the inference worker. */
export function isModelAsset(url: string, origin: string = 'http://localhost'): boolean {
	const target = new URL(url, origin);
	if (target.search) return false;
	const prefix = `/models/${MODEL_REPO}/`;
	return (
		(target.origin === origin &&
			target.pathname.startsWith(prefix) &&
			[
				'config.json',
				'tokenizer_config.json',
				'tokenizer.json',
				'generation_config.json',
				'special_tokens_map.json',
				'vocab.txt',
				'onnx/model_quantized.onnx'
			].includes(target.pathname.slice(prefix.length))) ||
		(target.protocol === 'https:' &&
			target.hostname === 'cdn.jsdelivr.net' &&
			/^\/npm\/@huggingface\/transformers@3\.8\.1\/dist\/ort-wasm-simd-threaded\.jsep\.(wasm|mjs)$/.test(
				target.pathname
			))
	);
}
