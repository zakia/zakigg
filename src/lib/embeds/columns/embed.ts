import * as v from 'valibot';
import { defineComponentEmbed } from '$lib/editor/components/registry';

export const columnSchema = v.object({
	markdown: v.string(),
	width: v.optional(v.union([v.number(), v.string()]))
});

export const propsSchema = v.object({
	columns: v.pipe(v.array(columnSchema), v.minLength(2), v.maxLength(4)),
	gap: v.optional(v.picklist(['small', 'medium', 'large']))
});

export type ColumnsProps = v.InferOutput<typeof propsSchema>;

export const embed = defineComponentEmbed({
	id: 'core.Columns',
	markdownName: 'Columns',
	label: 'Columns',
	description: 'Resizable side-by-side content',
	icon: 'mdi:view-column-outline',
	editLabel: 'Edit columns',
	keywords: ['layout', 'grid', 'split'],
	fields: [],
	props: propsSchema,
	initialProps: (): ColumnsProps => ({
		gap: 'medium',
		columns: [{ markdown: 'First column' }, { markdown: 'Second column' }]
	}),
	insertable: false,
	load: () => import('./Columns.svelte')
});
