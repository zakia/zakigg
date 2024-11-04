<script lang="ts">
	import Highlight from '$lib/Highlight.svelte';
</script>

<ol class="list-decimal-inside">
	<li>A list of <strong>slides</strong> and <strong>triggers</strong></li>
	<li>
		Clicking a <strong>trigger</strong> should scroll to the appropriate <strong>slide</strong>
	</li>
</ol>

<Highlight
	header="tabs.html"
	language="html"
	code={`<div class="triggers">
  <button onclick="scrollTab(slide_1)">...
  <button onclick="scrollTab(slide_2)">...
</div>

<div class="container">
  <div class="slide">...
  <div class="slide">...
</div>`}
/>

<p><strong>How do we go about finding the correct scroll position?</strong></p>
