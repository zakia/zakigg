import { describe, expect, it } from 'vitest';
import { trimLinkText } from './link-selection';

describe('Markdown link selection', () => {
	it('excludes invisible boundary whitespace from a link mark', () => {
		expect(trimLinkText('  overview  ')).toEqual({ from: 2, to: 10 });
	});

	it('preserves whitespace inside the visible label', () => {
		expect(trimLinkText('interface overview')).toEqual({ from: 0, to: 18 });
	});

	it('rejects selections containing only whitespace', () => {
		expect(trimLinkText(' \t ')).toBeNull();
	});
});
