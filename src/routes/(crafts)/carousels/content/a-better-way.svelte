<script>
	import Highlight from '$lib/Highlight.svelte';
</script>

<p>
	Fortunately for us, there's a more direct way to get the scroll position without dealing with
	widths and gaps.
</p>
<h6 class="mt-2">The <code>offsetLeft</code> property</h6>
<blockquote class="border-primary border-l-4 pl-2">
	<p>
		<em
			>This property returns the number of pixels that the upper left corner of the current element
			is offset to the left within it&#39;s parent.<sup class="text-primary">*</sup></em
		>
	</p>
</blockquote>
<p class="-mt-2">
	<span class="text-primary">*</span>
	<small>
		This is only true if we have <code>position:relative</code> on the parent. Otherwise,
		<code>offsetLeft</code> returns the distance to the edge of the screen</small
	>
</p>

<p>
	Because <code>display: flex</code> places our items in a row, a slide&#39;s
	<code>offsetLeft</code> value is exactly equal to it&#39;s scroll position. (even with the overflow)
</p>
<Highlight
	header="tabs.ts"
	language="javascript"
	code={`const scrollTab = (slide) => {
  container.scrollTo({
    left: slide.offsetLeft,
    behavior: "smooth",
  });
};`}
/>
<p><b>That's all we need to implement the triggers.</b></p>
<p>
	Adding <code>behavior: &quot;smooth&quot;</code> nicely animates the scroll without us having to do
	anything else.
</p>
<p>
	Also, because we calculate <code>offsetLeft</code> the moment a trigger is clicked, it will always
	be up-to-date.
</p>
