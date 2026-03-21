<script module lang="ts">
	import type { SnippetMeta } from '$lib/snippets';

	export const meta: SnippetMeta = {
		title: 'Centered Title',
		description:
			'How to truly center a nav title with flexbox — even when the sides are different widths.',
		published: '2026-02-20',
		tags: ['snippet']
	};
</script>

<script>
	import Preview from '$lib/components/Preview.svelte';
	import Stepper from '$lib/components/Stepper.svelte';
</script>

<Stepper>
	<Preview>
		{#snippet description()}
			<h2>The starting point</h2>
			<p>
				Centering a title in a navbar sounds trivial. Just slap <code>text-center</code> on the nav and
				call it a day, right?
			</p>
		{/snippet}
		<nav role="presentation" class="text-center">
			<h3>My Centered Title</h3>
		</nav>
	</Preview>

	<Preview>
		{#snippet description()}
			<h2>Adding more elements</h2>
			<p>
				Now add a logo and some links. They stack vertically because <code>nav</code> is a block element
				and its children are blocks too — each one takes the full width.
			</p>
		{/snippet}
		<nav role="presentation" class="text-center">
			<a>LOGO</a>
			<h3>My Centered Title</h3>
			<div>
				<a>Link 1</a>
				<a>Link 2</a>
				<a>Link 3</a>
			</div>
		</nav>
	</Preview>

	<Preview>
		{#snippet description()}
			<h2>Flexbox to the rescue?</h2>
			<p>
				Use <code>display: flex</code> with <code>justify-content: space-between</code> and
				<code>align-items: center</code>. Now everything sits in a row and the title looks centered.
			</p>
		{/snippet}
		<nav role="presentation" class="flex items-center justify-between">
			<a>LOGO</a>
			<h3>My Centered Title</h3>
			<div class="flex gap-2">
				<a>Link 1</a>
				<a>Link 2</a>
				<a>Link 3</a>
			</div>
		</nav>
	</Preview>

	<Preview debug>
		{#snippet description()}
			<h2>It's not actually centered</h2>
			<p>
				Turn on outlines and the illusion breaks. <code>space-between</code> distributes
				<strong>equal gaps</strong> between the three items — but if the logo and links are different
				widths, the title gets pushed off-center.
			</p>
			<p>
				The title is centered <em>between its neighbors</em>, not centered in the
				<em>viewport</em>. That's the core problem.
			</p>
		{/snippet}
		<nav role="presentation" class="flex items-center justify-between">
			<a>LOGO</a>
			<h3>My Centered Title</h3>
			<div class="flex gap-2">
				<a>Link 1</a>
				<a>Link 2</a>
				<a>Link 3</a>
			</div>
		</nav>
	</Preview>

	<Preview debug>
		{#snippet description()}
			<h2>The fix: equal-width sides</h2>
			<p>
				Wrap the left and right items in containers and give both <code>basis-1/2</code>. Each side
				now takes exactly half the remaining space, so the title lands at the true center.
			</p>
			<p>
				The key insight: <strong
					>if both sides are the same width, the middle is always centered</strong
				> — regardless of content.
			</p>
		{/snippet}
		<nav role="presentation" class="flex items-center justify-between">
			<div class="basis-1/2">
				<a>LOGO</a>
			</div>
			<h3 class="shrink-0">My Centered Title</h3>
			<div class="flex basis-1/2 justify-end gap-2">
				<a>Link 1</a>
				<a>Link 2</a>
				<a>Link 3</a>
			</div>
		</nav>
	</Preview>

	<Preview debug>
		{#snippet description()}
			<h2>Fluid version with flex-1</h2>
			<p>
				Replace <code>basis-1/2</code> with <code>flex-1</code> — same centering effect, but the sides
				grow and shrink fluidly with the container.
			</p>
			<p>
				Add <code>flex-wrap</code> so the layout stacks gracefully on small screens. Try dragging the
				resize handle to see it in action.
			</p>
		{/snippet}
		<nav role="presentation" class="flex flex-wrap items-center justify-between">
			<div class="flex-1">
				<a>LOGO</a>
			</div>
			<h3 class="shrink-0">My Centered Title</h3>
			<div class="flex flex-1 justify-end gap-2">
				<a>Link 1</a>
				<a>Link 2</a>
				<a>Link 3</a>
			</div>
		</nav>
	</Preview>

	<Preview>
		{#snippet description()}
			<h2>Final result</h2>
			<p>
				Remove the debug outlines and you've got a clean, responsive navbar with a
				<strong>truly centered title</strong> — no matter what's on either side.
			</p>
		{/snippet}
		<nav role="presentation" class="flex flex-wrap items-center justify-between">
			<div class="flex-1">
				<a>LOGO</a>
			</div>
			<h3 class="shrink-0">My Centered Title</h3>
			<div class="flex flex-1 justify-end gap-2">
				<a>Link 1</a>
				<a>Link 2</a>
				<a>Link 3</a>
			</div>
		</nav>
	</Preview>
</Stepper>

<style>
	nav {
		padding: var(--s1);
		background-color: var(--base-2);
	}
</style>
