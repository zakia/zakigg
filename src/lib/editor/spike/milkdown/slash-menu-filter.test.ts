import { describe, expect, it } from 'vitest';
import { SLASH_MENU_ITEMS } from './slash-menu';
import { filterSlashMenuItems } from './slash-menu-filter';

describe('filterSlashMenuItems', () => {
	it('does not match a query in the middle of an unrelated keyword', () => {
		expect(filterSlashMenuItems(SLASH_MENU_ITEMS, 'you').map((item) => item.key)).toEqual([
			'youtube'
		]);
	});

	it('matches labels, descriptions, and keyword prefixes', () => {
		expect(filterSlashMenuItems(SLASH_MENU_ITEMS, 'head').map((item) => item.key)).toEqual([
			'heading-1',
			'heading-2',
			'heading-3'
		]);
		expect(filterSlashMenuItems(SLASH_MENU_ITEMS, 'lay').map((item) => item.key)).toContain(
			'columns'
		);
	});

	it('includes insertable components discovered from their folders', () => {
		expect(filterSlashMenuItems(SLASH_MENU_ITEMS, 'timer').map((item) => item.key)).toContain(
			'component:core.Timer'
		);
		expect(filterSlashMenuItems(SLASH_MENU_ITEMS, 'callout').map((item) => item.key)).toContain(
			'component:core.Callout'
		);
	});
});
