import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const calloutKinds = ['note', 'tip', 'important', 'warning', 'caution'] as const;

export const propsSchema = v.object({
	kind: v.picklist(calloutKinds),
	markdown: v.string()
});

export type CalloutProps = v.InferOutput<typeof propsSchema>;

export const embed = defineComponentEmbed({
	id: 'core.Callout',
	markdownName: 'Callout',
	label: 'Callout',
	description: 'Highlighted note, tip, or warning',
	icon: 'mdi:information-outline',
	editLabel: 'Edit callout',
	keywords: ['note', 'tip', 'warning'],
	fields: [
		{
			name: 'kind',
			label: 'Kind',
			type: 'select',
			options: calloutKinds.map((kind) => ({ label: kind, value: kind }))
		},
		{ name: 'markdown', label: 'Content', type: 'textarea' }
	],
	props: propsSchema,
	initialProps: (): CalloutProps => ({ kind: 'note', markdown: 'Helpful context.' }),
	load: () => import('./Callout.svelte')
});
