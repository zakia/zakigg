<script lang="ts">
	import MediaEmbed from '$lib/editor/presentation/MediaEmbed.svelte';
	import type { InferOutput } from 'valibot';
	import type { propsSchema } from './embed';

	type Props = InferOutput<typeof propsSchema> & {
		editing?: boolean;
		updateProps?: (props: Record<string, unknown>) => void;
	};
	let { editing, updateProps, ...media }: Props = $props();
</script>

<MediaEmbed kind="image" {...media} {editing} {updateProps} />
