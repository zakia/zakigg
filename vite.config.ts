import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [enhancedImages(), sveltekit(), tailwindcss()],
	build: {
		rollupOptions: {
			output: {
				onlyExplicitManualChunks: true,
				manualChunks(id) {
					// Keep read-only document presentation reusable without Rollup folding its
					// small shared config into the much larger interactive editor chunk.
					if (id.includes('/src/lib/editor/presentation/')) return 'editor-presentation';
				}
			}
		}
	}
});
