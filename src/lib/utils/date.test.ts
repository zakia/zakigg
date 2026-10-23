import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { formatDate, formatMonth, parseDate, shiftMonth } from './date';

describe('parseDate', () => {
	it.each([
		['02 Oct 2026', '2026-10-02'],
		['01 Oct 2026', '2026-10-01'],
		['30 Sep 2026', '2026-09-30'],
		['29 Sep 2026', '2026-09-29'],
		['28 Sep 2026', '2026-09-28'],
		['  02\u00a0oCt\u00a02026  ', '2026-10-02'],
		['2 October 2026', '2026-10-02'],
		['October 2, 2026', '2026-10-02'],
		['Oct. 02, 2026', '2026-10-02'],
		['30 Sept. 2026', '2026-09-30'],
		['02-Oct-2026', '2026-10-02'],
		['02/Oct/2026', '2026-10-02'],
		['2026-Oct-02', '2026-10-02'],
		['2026-10-02', '2026-10-02'],
		['2026/10/2', '2026-10-02'],
		['2026.10.02', '2026-10-02'],
		['20261002', '2026-10-02'],
		['2026-10-02T23:30:00-04:00', '2026-10-02'],
		['29 February 2024', '2024-02-29']
	])('parses %s as a Temporal date %s', (value, expected) => {
		const date = parseDate(value);
		expect(date).toBeInstanceOf(Temporal.PlainDate);
		expect(date?.toString()).toBe(expected);
	});

	it('recognizes every abbreviated and full English month', () => {
		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December'
		];
		months.forEach((month, index) => {
			const expected = `2026-${String(index + 1).padStart(2, '0')}-02`;
			expect(parseDate(`02 ${month} 2026`)?.toString()).toBe(expected);
			expect(parseDate(`${month.slice(0, 3)} 2, 2026`)?.toString()).toBe(expected);
		});
	});

	it('uses date order only for numeric month/day ambiguity', () => {
		expect(parseDate('03/04/2026')?.toString()).toBe('2026-03-04');
		expect(parseDate('03/04/2026', { order: 'DMY' })?.toString()).toBe('2026-04-03');
		expect(parseDate('02 Oct 2026', { order: 'MDY' })?.toString()).toBe('2026-10-02');
		expect(parseDate('Oct 02 2026', { order: 'DMY' })?.toString()).toBe('2026-10-02');
		expect(parseDate('2026/10/02', { order: 'DMY' })?.toString()).toBe('2026-10-02');
		expect(parseDate('31/01/2026', { order: 'DMY' })?.toString()).toBe('2026-01-31');
		expect(parseDate('31/01/2026', { order: 'MDY' })).toBeNull();
	});

	it.each([
		'',
		'   ',
		'not a date',
		'31 Sep 2026',
		'29 Feb 2026',
		'32 Oct 2026',
		'00 Oct 2026',
		'2026-02-30',
		'2026/13/01',
		'2026/00/01',
		'Oct 2026',
		'02 Octopus 2026',
		'02 Oct 26',
		'01/02/03',
		'02 Oct 2026 trailing text'
	])('rejects invalid or incomplete date %s without constraining it', (value) => {
		expect(parseDate(value)).toBeNull();
	});
});

describe('Temporal formatting and month arithmetic', () => {
	it('formats calendar dates without shifting them through a timezone', () => {
		expect(
			formatDate('2026-10-02', { month: 'long', day: 'numeric', year: 'numeric' }, 'en-US')
		).toBe('October 2, 2026');
		expect(
			formatDate(Temporal.PlainDate.from('2026-10-02'), { month: 'short', day: 'numeric' })
		).toBe('Oct 2');
		expect(formatDate('invalid')).toBe('');
	});

	it('formats and shifts year-month values across year boundaries', () => {
		expect(formatMonth('2026-10')).toBe('October 2026');
		expect(formatMonth('2026-10', true)).toBe('Oct 2026');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(shiftMonth('2025-12', 2)).toBe('2026-02');
		expect(shiftMonth('', -1)).toBeNull();
		expect(shiftMonth('2026-13', -1)).toBeNull();
		expect(formatMonth('')).toBe('');
	});
});
