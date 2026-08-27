import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const propsSchema = v.object({
	endIsoTimestamp: v.pipe(
		v.string(),
		v.isoTimestamp('Use an ISO timestamp like 2026-06-21T18:00:00.000Z.')
	)
});

export type TimerProps = v.InferOutput<typeof propsSchema>;

export const embed = defineComponentEmbed({
	id: 'core.Timer',
	label: 'Timer',
	description: 'Live countdown to a date and time',
	icon: 'mdi:timer-outline',
	keywords: ['countdown', 'date', 'time'],
	fields: [
		{ name: 'endIsoTimestamp', label: 'End time', type: 'text', placeholder: 'ISO timestamp' }
	],
	props: propsSchema,
	initialProps: () => ({
		endIsoTimestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString()
	}),
	load: () => import('./Timer.svelte')
});
