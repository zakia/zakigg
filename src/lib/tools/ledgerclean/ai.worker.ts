import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import {
	MODEL_REPO,
	MODEL_CACHE,
	ASSET_DOWNLOAD_LIMIT,
	isModelAsset,
	parseClassificationInput,
	merchantText
} from './local-ai-contract';
import head from './setfit-head.json';
import { classifySetFit } from './setfit';

let downloadsAllowed = true;
let downloaded = 0;
const originalFetch = self.fetch.bind(self);
self.fetch = async (request, init) => {
	const url =
		typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
	if (
		!downloadsAllowed ||
		!isModelAsset(url, self.location.origin) ||
		(init?.method && init.method !== 'GET')
	)
		throw new Error('Local AI only downloads approved static model assets.');
	const runtime = url.startsWith('https://cdn.jsdelivr.net/');
	const cache = await caches.open(MODEL_CACHE);
	if (runtime) {
		const cached = await cache.match(url);
		if (cached) return cached;
	}
	const response = await originalFetch(request, init);
	if (!response.ok || !response.body) return response;
	const reader = response.body.getReader();
	const tracked = new Response(
		new ReadableStream({
			async pull(controller) {
				try {
					const { done, value } = await reader.read();
					if (done) {
						controller.close();
						return;
					}
					downloaded += value.byteLength;
					if (downloaded > ASSET_DOWNLOAD_LIMIT) {
						await reader.cancel();
						throw new Error('Local AI download exceeds the 400 MB limit.');
					}
					self.postMessage({
						type: 'progress',
						progress: Math.min(0.95, downloaded / 50_000_000),
						downloaded
					});
					controller.enqueue(value);
				} catch (error) {
					controller.error(error);
				}
			},
			cancel: (reason) => reader.cancel(reason)
		}),
		{ status: response.status, statusText: response.statusText, headers: response.headers }
	);
	if (runtime) await cache.put(url, tracked.clone());
	return tracked;
};
let encoder: FeatureExtractionPipeline | null = null;
const vectors = new Map<string, number[]>();
async function embed(texts: string[]) {
	if (!encoder) throw new Error('Load local AI before categorizing.');
	if (vectors.size + texts.length > 512) vectors.clear();
	const missing = [...new Set(texts)].filter((text) => !vectors.has(text));
	if (missing.length) {
		const output = await encoder(missing, { pooling: 'mean', normalize: true });
		const encoded = output.tolist() as number[][];
		missing.forEach((text, index) => vectors.set(text, encoded[index]));
	}
	return texts.map((text) => vectors.get(text)!);
}
self.onmessage = async ({
	data
}: MessageEvent<{ id: number; type: 'load' | 'classify'; input?: unknown }>) => {
	try {
		if (data.type === 'load') {
			env.allowLocalModels = true;
			env.allowRemoteModels = false;
			env.localModelPath = '/models/';
			env.useBrowserCache = false;
			env.useCustomCache = true;
			env.customCache = await caches.open(MODEL_CACHE);
			env.backends.onnx.wasm!.numThreads = 1;
			encoder = await pipeline<'feature-extraction'>('feature-extraction', MODEL_REPO, {
				dtype: 'q8',
				device: 'wasm'
			});
			downloadsAllowed = false;
			self.postMessage({ id: data.id, result: { downloaded } });
			return;
		}
		const input = parseClassificationInput(data.input);
		const encoded = await embed(input.transactions.map((row) => merchantText(input, row)));
		const assignments = input.transactions.map((row, index) => ({
			t: row.t,
			...classifySetFit(encoded[index], head, input)
		}));
		self.postMessage({ id: data.id, result: { assignments } });
	} catch (cause) {
		self.postMessage({
			id: data.id,
			error: cause instanceof Error ? cause.message : 'Local AI failed.'
		});
	}
};
