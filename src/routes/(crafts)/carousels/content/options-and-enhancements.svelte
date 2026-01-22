<script>
	import Toggle from '$lib/components/Toggle.svelte';
	import Highlight from '$lib/Highlight.svelte';
	import { useScrollingTabs } from './Tabs.svelte';
	const tabs = useScrollingTabs();
</script>

<p>
	We can snap slides into place using the <a
		target="_blank"
		class="text-text border-b-current"
		href="https://developer.mozilla.org/docs/Web/CSS/CSS_scroll_snap"
		><code>scroll-snap-type</code></a
	> property.
</p>

<Highlight
	header="tabs.css"
	language="css"
	code={`.container {
  display: flex;
  overflow: auto; /* allow scrolling */
  scroll-snap-type: "x mandatory"; /* snap to slides */
}

.slide {
  width: 100%;
  flex-shrink: 0;
  scroll-snap-align: start; /* set snapping point */
}`}
/>
<p>
	<strong>We've actually been using this property all along</strong>, but I didn't mention it
	earlier because it's a little bit buggy out-of-the-box :(
</p>
<p>
	<code>scroll-snap</code> works pretty well when scrolling, but there's some jank when using the triggers.
</p>
<p>
	To get around this, we temporarily disable snapping when a trigger is clicked, and re-enable it
	after the finishes.
</p>
<br />
<p>
	Next, we can set <code>overflow: hidden</code> to prevent scrolling and only allow navigation with
	the triggers.
</p>

<div class="flex items-center gap-1">
	<code class="mr-2">overflow:</code>
	<code class:saturate-25={tabs.isTrigger}>auto</code>
	<Toggle bind:checked={tabs.isTrigger}></Toggle>
	<code class:saturate-25={!tabs.isTrigger}>hidden</code>
</div>
<p>
	In general, it's a good idea to allow scrolling. This way, users can navigate using their
	preferred method.
</p>
<br />
<p>
	Finally, you&#39;ll also notice the correct trigger highlights as we scroll. This is done using
	the <a target="_blank" href="https://developer.mozilla.org/docs/Web/API/Intersection_Observer_API"
		>Intersection Observer API.</a
	>
</p>
