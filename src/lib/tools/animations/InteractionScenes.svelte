<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';

	let {
		label,
		duration,
		easing,
		switchOn,
		menuOpen,
		notificationVisible,
		onswitch,
		onmenu,
		onnotification
	}: {
		label: string;
		duration: number;
		easing: string;
		switchOn: boolean;
		menuOpen: boolean;
		notificationVisible: boolean;
		onswitch: () => void;
		onmenu: () => void;
		onnotification: () => void;
	} = $props();
</script>

<div class="scenes" style={`--duration: ${duration}ms; --easing: ${easing}`}>
	<button
		type="button"
		class="scene"
		aria-label={`${label}: toggle switch on both sides`}
		aria-pressed={switchOn}
		onclick={onswitch}
	>
		<span class="scene-label">Switch <span>Slide & settle</span></span>
		<span class="stage" aria-hidden="true">
			<span class="switch" class:active={switchOn}><span class="switch-thumb"></span></span>
		</span>
	</button>
	<button
		type="button"
		class="scene"
		aria-label={`${label}: toggle menu on both sides`}
		aria-expanded={menuOpen}
		onclick={onmenu}
	>
		<span class="scene-label">Menu <span>Open & unfold</span></span>
		<span class="stage menu-stage" aria-hidden="true">
			<span class="menu-trigger"><Icon icon="mdi:dots-horizontal" /></span>
			<span class="mini-menu" class:active={menuOpen}>
				<span><Icon icon="mdi:pencil-outline" /> Edit</span>
				<span><Icon icon="mdi:content-copy" /> Duplicate</span>
			</span>
		</span>
	</button>
	<button
		type="button"
		class="scene"
		aria-label={`${label}: toggle notification on both sides`}
		aria-pressed={notificationVisible}
		onclick={onnotification}
	>
		<span class="scene-label">Notification <span>Pop into place</span></span>
		<span class="stage" aria-hidden="true">
			<span class="notification-placeholder">Click to preview</span>
			<span class="notification" class:active={notificationVisible}
				><span class="check"><Icon icon="mdi:check" /></span> Changes saved</span
			>
		</span>
	</button>
</div>

<style>
	.scenes {
		padding: 0 1.5rem;
	}
	.scene {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		height: 6rem;
		padding: 0;
		background: transparent;
		border: 0;
		border-top: 1px solid var(--edge);
		color: var(--content);
		text-align: left;
		font: inherit;
		cursor: pointer;
	}
	.scene-label {
		font-size: 0.78rem;
		font-weight: 550;
	}
	.scene-label > span {
		display: block;
		color: var(--content-1);
		font-size: 0.64rem;
		font-weight: 400;
		margin-top: 0.3rem;
	}
	.stage {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		min-width: 0;
		height: 100%;
	}
	.switch {
		display: block;
		width: 4.5rem;
		height: 2.5rem;
		padding: 0.25rem;
		border-radius: 2rem;
		background: var(--edge);
		transition: background-color 150ms ease;
	}
	.switch.active {
		background: var(--motion-color);
	}
	.switch-thumb {
		display: block;
		width: 2rem;
		height: 2rem;
		background: var(--brand-content);
		border-radius: 50%;
		box-shadow: 0 2px 5px #0002;
		transform: translateX(0);
		transition: transform var(--duration) var(--easing);
	}
	.active .switch-thumb {
		transform: translateX(2rem);
	}
	.menu-trigger {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 2rem;
		height: 2rem;
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: 0.5rem;
		position: absolute;
		left: calc(50% - 4.5rem);
		top: 1rem;
		font-size: 1.15rem;
	}
	.mini-menu {
		display: grid;
		gap: 0.5rem;
		width: 7.5rem;
		padding: 0.7rem;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: 0.6rem;
		box-shadow: 0 4px 12px #0000000a;
		transform-origin: top left;
		transform: translateY(-8px) scale(0.65);
		opacity: 0;
		transition:
			transform var(--duration) var(--easing),
			opacity var(--duration) var(--easing);
		position: absolute;
		left: calc(50% - 2rem);
		top: 1rem;
	}
	.mini-menu.active {
		transform: translateY(0) scale(1);
		opacity: 1;
	}
	.mini-menu > span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.65rem;
	}
	.notification-placeholder {
		color: var(--content-1);
		font-size: 0.65rem;
	}
	.notification {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: absolute;
		white-space: nowrap;
		border: 1px solid var(--edge);
		border-radius: 0.65rem;
		padding: 0.8rem 0.9rem;
		font-size: 0.7rem;
		font-weight: 500;
		background: var(--base-1);
		box-shadow: 0 4px 12px #0000000a;
		transform: translateY(18px) scale(0.8);
		opacity: 0;
		transition:
			transform var(--duration) var(--easing),
			opacity var(--duration) var(--easing);
	}
	.notification.active {
		transform: translateY(0) scale(1);
		opacity: 1;
	}
	.check {
		display: flex;
		padding: 0.15rem;
		border-radius: 50%;
		background: var(--motion-color);
		color: var(--base-1);
	}
	.scene:focus-visible {
		outline: 2px solid var(--motion-color);
		outline-offset: -2px;
		border-radius: 0.5rem;
	}
	.scene:hover .scene-label {
		color: var(--motion-color);
	}
	@media (max-width: 42rem) {
		.scenes {
			padding: 0 1.25rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.switch,
		.switch-thumb,
		.mini-menu,
		.notification {
			transition: none;
		}
	}
</style>
