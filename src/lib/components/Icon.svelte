<script lang="ts">
	import OnlineIcon, { type IconProps as IconifyIconProps } from '@iconify/svelte';
	import OfflineIcon from '@iconify/svelte/dist/OfflineIcon.svelte';
	import { getRegisteredIcon } from './icon-registry';

	type IconProps = IconifyIconProps & {
		icon: string;
		class?: string;
	};

	let { icon, class: className = '', ...props }: IconProps = $props();

	const registeredIcon = $derived(getRegisteredIcon(icon));
</script>

{#if registeredIcon}
	<OfflineIcon icon={registeredIcon} class={className} {...props} />
{:else}
	<OnlineIcon {icon} class={className} {...props} />
{/if}
