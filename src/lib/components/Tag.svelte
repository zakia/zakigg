<script lang="ts">
	import { tagColor } from './tag';
	let { name }: { name: string } = $props();
</script>

<span class="tag-badge" style:--tag-color={tagColor(name)}>{name}</span>
