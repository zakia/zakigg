import { describe, expect, it } from 'vitest';
import {
	matchCategory,
	merchantText,
	isModelAsset,
	MODEL_REPO,
	parseClassificationInput
} from './local-ai-contract';

describe('compact local classifier boundary', () => {
	it('limits worker downloads to versioned local model and pinned runtime artifacts', () => {
		const root = `http://localhost/models/${MODEL_REPO}/`;
		expect(isModelAsset(`${root}onnx/model_quantized.onnx`)).toBe(true);
		expect(isModelAsset(`/models/${MODEL_REPO}/config.json`)).toBe(true);
		expect(
			isModelAsset(
				'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm'
			)
		).toBe(true);
		for (const url of [
			`${root}onnx/model.onnx`,
			`${root}tokenizer.json?merchant=SECRET`,
			root.replace(MODEL_REPO, 'other-model') + 'config.json',
			'https://api.deepinfra.com/v1/openai/chat/completions',
			'https://huggingface.co/other/model/resolve/main/config.json'
		])
			expect(isModelAsset(url)).toBe(false);
	});
	it('leaves weak or closely tied matches for review and ranks across category IDs rather than examples', () => {
		const choices = [
			{ name: 'Dining and Coffee', vector: [0.8, 0.1] },
			{ name: 'Dining and Coffee', vector: [0.79, 0.11] },
			{ name: 'Household', vector: [0.3, 0.7] }
		];
		expect(matchCategory([1, 0], choices, 'Unknown')).toBe('Dining and Coffee');
		expect(matchCategory([0, 1], choices, 'Unknown')).toBe('Household');
		expect(matchCategory([0.1, 0.1], choices, 'Unknown')).toBe('Unknown');
		expect(
			matchCategory(
				[1, 0],
				[
					{ name: 'Dining and Coffee', vector: [0.8, 0] },
					{ name: 'Household', vector: [0.78, 0] }
				],
				'Unknown'
			)
		).toBe('Unknown');
		expect(matchCategory([1, 0], [], 'Unknown')).toBe('Unknown');
	});
	it('uses bounded merchant context and requires an existing review category', () => {
		const input = parseClassificationInput({
			fallback: 'Unknown',
			categories: [
				{ name: 'Dining and Coffee', purpose: 'Meals' },
				{ name: 'Unknown', purpose: 'Review' }
			],
			guidance: 'Work software',
			examples: [{ d: 'Lunch', c: 'Dining and Coffee' }],
			transactions: [{ t: 0, d: 'SHOP 123 TORONTO', bankCategory: 'Dining', direction: 'out' }]
		});
		expect(merchantText(input, input.transactions[0])).toBe('shop toronto. dining. work software');
		expect(() =>
			parseClassificationInput({ ...input, categories: [...input.categories, ...input.categories] })
		).toThrow();
		expect(() => parseClassificationInput({ ...input, fallback: 'Missing' })).toThrow();
		expect(() => parseClassificationInput({ ...input, apiKey: 'secret' })).toThrow();
	});
});
