<script lang="ts">
	import OnlineIcon, { type IconProps as IconifyIconProps } from '@iconify/svelte';
	import OfflineIcon from '@iconify/svelte/dist/OfflineIcon.svelte';
	import { getRegisteredIcon } from './icon-registry';

	type IconProps = IconifyIconProps & {
		icon: string;
		class?: string;
		'aria-hidden'?: boolean | 'true' | 'false';
		'aria-label'?: string;
	};

	let {
		icon,
		class: className = '',
		'aria-hidden': ariaHiddenProp,
		'aria-label': ariaLabel,
		...props
	}: IconProps = $props();

	const registeredIcon = $derived(getRegisteredIcon(icon));
	const ariaHidden = $derived(ariaHiddenProp ?? (ariaLabel ? undefined : ('true' as const)));
</script>

{#if registeredIcon}
	<OfflineIcon
		icon={registeredIcon}
		class={className}
		aria-hidden={ariaHidden}
		aria-label={ariaLabel}
		{...props}
	/>
{:else}
	<OnlineIcon {icon} class={className} aria-hidden={ariaHidden} aria-label={ariaLabel} {...props} />
{/if}
