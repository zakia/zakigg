<script>
	import Highlight from '$lib/Highlight.svelte';
</script>

<p>
	We can get <b>scrollable</b>, <b>responsive</b>, and <b>animated</b> Tabs with
	<em>just 5 lines of CSS:</em>
</p>
<Highlight
	header="tabs.css"
	language="css"
	code={`.container {
  display: flex; /* place slides in a row */
  overflow: auto; /* make container scrollable */
  position: relative; /* this will come in handy later */
}

.slide {
  width: 100%; /* make slides responsive */
  flex-shrink: 0; /* prevent shrinking */
}`}
></Highlight>

<p>
	<b>This doesn't give us the tab triggers out of the box,</b> but we do get a solid foundation to build
	upon.
</p>
<p>
	We already have a <b>natively scrollable</b> container and
	<b>responsive slides</b> before touching javascript. (try scrolling to the right)
</p>
