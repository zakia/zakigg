<script>
	import tabsDemo from './tabs_demo.mov';
</script>

<p>
	Rather than thinking of the content moving, we can reframe the idea of scrolling as moving a <b
		>viewport</b
	> across a fixed strip of content.
</p>

<p>Turns out, the <b>scroll position</b> of a slide is just the amount of space to it's left.</p>

<video src={tabsDemo} autoplay muted loop playsinline class="rounded-lg my-4"> </video>
<p>
	You could probably spot the formula <code class="whitespace-nowrap">index * (width + gap)</code>
</p>
<p>
	<b>This will work</b>, but it means that we either need to use a <b>fixed</b> width and gap,
	<em>or</em>
	we need to calculate the widths and gaps.
	<br />
	<small>(and make sure they stay up-to-date as the screen is resized)</small>
</p>
