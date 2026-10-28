/** Remove only retired LedgerClean model assets, leaving the app shell and other models alone. */
export async function removeLegacyModelDownloads() {
	if (typeof caches === 'undefined') return;
	for (const name of await caches.keys()) {
		if (
			name.startsWith('ledgerclean-local-ai-setfit-') ||
			name === 'ledgerclean-local-ai-minilm-v1'
		) {
			await caches.delete(name);
			continue;
		}
		if (!['webllm/model', 'webllm/wasm', 'webllm/config'].includes(name)) continue;
		const cache = await caches.open(name);
		for (const request of await cache.keys()) {
			const url = new URL(request.url);
			const weights =
				url.hostname === 'huggingface.co' &&
				/^\/mlc-ai\/(?:Qwen2\.5-1\.5B-Instruct-q4f16_1-MLC|Qwen3-0\.6B-q4f16_1-MLC)\//.test(
					url.pathname
				);
			const runtime =
				url.hostname === 'raw.githubusercontent.com' &&
				url.pathname.startsWith('/mlc-ai/binary-mlc-llm-libs/') &&
				/\/(?:Qwen2-1\.5B-Instruct-q4f16_1_cs1k-webgpu|Qwen3-0\.6B-q4f16_1_cs1k-webgpu)\.wasm$/.test(
					url.pathname
				);
			if (weights || runtime) await cache.delete(request);
		}
	}
}
