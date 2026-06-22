import { createComponentEmbedRegistry, registerComponentEmbed } from '$lib/editor/component-embeds';
import OverflowToggle, { overflowToggleEmbed } from './carousels/content/OverflowToggle.svelte';
import ScrollingTabs, { scrollingTabsEmbed } from './carousels/content/ScrollingTabs.svelte';
import ScrollingTabsAnchors, {
	scrollingTabsAnchorsEmbed
} from './carousels/content/ScrollingTabsAnchors.svelte';
import Timer, { timerEmbed } from './embeds/Timer.svelte';

export const craftComponentEmbeds = createComponentEmbedRegistry([
	registerComponentEmbed(Timer, timerEmbed),
	registerComponentEmbed(ScrollingTabs, scrollingTabsEmbed),
	registerComponentEmbed(ScrollingTabsAnchors, scrollingTabsAnchorsEmbed),
	registerComponentEmbed(OverflowToggle, overflowToggleEmbed)
]);
