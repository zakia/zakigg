import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [enhancedImages(), sveltekit(), tailwindcss()],
	// Milkdown's packaged UI components use Vue's runtime build. Declare its
	// compile-time flags explicitly so the Svelte app stays warning-free and
	// dead Vue compatibility branches can be removed from production bundles.
	define: {
		__VUE_OPTIONS_API__: false,
		__VUE_PROD_DEVTOOLS__: false,
		__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
	},
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
