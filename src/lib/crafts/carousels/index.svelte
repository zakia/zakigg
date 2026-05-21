<script lang="ts">
	import Icon from '@iconify/svelte';
	import ScrollingTabs from './content/ScrollingTabs.svelte';
	import ScrollingTabsAnchors from './content/ScrollingTabsAnchors.svelte';
	import { data } from './content/Tabs.svelte';
</script>

<p>
	You don't have to look far on the internet to come across <strong>tabs</strong> or
	<strong>carousels</strong>.
</p>
<p>
	Almost any website I work on these days includes at least one of them. I've seen dozens of
	implementations, and yet there always seems to be something missing.
</p>
<p><strong>So I decided to give it a go myself.</strong></p>
<p>
	The goal here isn't to replace the numerous carousel and tab libraries out there. <br />
	Instead, I'd just like to explore what's possible using some basic CSS and JavaScript.
</p>
<ScrollingTabs />
{#each data as { title, icon, Content }}
	<h2 class="text-brand gap-s-2 flex items-center">
		<Icon {icon} class="h-8 w-8" />
		{title}
	</h2>
	<Content />
{/each}
<h2 class="text-brand gap-s-2 flex items-center">
	<Icon icon="lucide:clapperboard" class="h-8 w-8" />
	Bloopers
</h2>

<p>
	I would have loved to implement a version without JavaScript, using anchor tags as triggers — <code
		>&lt;a href="#slide-id"...</code
	> (which I did).
</p>

<p><strong>However, it's a bit limited:</strong></p>
<ul class="list-disc-outside pl-s1">
	<li>
		Most browsers first scroll the entire page to the anchor, then to the correct slide. In some
		cases, this behavior might be desired, but it's not ideal for a carousel.
	</li>
	<li>The slides don’t always line up correctly (you may notice the border being cut off).</li>
</ul>
<p>
	I think we need at least some JavaScript for a fully functional carousel. Nonetheless, I’ve shared
	the implementation below if you’d like to experiment with it.
</p>
<ScrollingTabsAnchors />
<h3>That's a wrap!</h3>
<p>
	I hope you learned something from this <em>Craft.</em> I had a lot of fun putting it together :)
</p>
<p>
	Digging into this UI pattern and experimenting with different approaches has given me a new
	appreciation for what goes into making a proper tabs or carousel library.
</p>
<p>
	I'm fairly new to making these Craft pages, but I'm excited to share more of my experiments with
	you down the road.
</p>
<p>
	If you have any feedback, suggestions, or just wanna chat, feel free to <a href="mailto:a@zaki.gg"
		>reach out!</a
	>
</p>
