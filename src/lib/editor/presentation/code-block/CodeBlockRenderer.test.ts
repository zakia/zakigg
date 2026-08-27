import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import CodeBlockRenderer from './CodeBlockRenderer.svelte';

describe('CodeBlockRenderer', () => {
	it('renders the public code-block structure without editor dependencies', () => {
		const { body } = render(CodeBlockRenderer, {
			props: {
				title: 'Example',
				language: 'typescript',
				code: 'const value = 1;'
			}
		});

		expect(body).toContain('data-code-block');
		expect(body).toContain('data-code-language="typescript"');
		expect(body).toContain('Example');
		expect(body).toContain('TypeScript');
		expect(body).toContain('aria-label="Copy code"');
		expect(body).toContain('const value = 1;');
	});
});
