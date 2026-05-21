<script lang="ts">
	import { type Snippet } from 'svelte';
	import { tick } from 'svelte';
	import Prism from 'prismjs';
	import 'prismjs/components/prism-markup.js';
	import '$lib/tomorrow.css';

	interface Props {
		children: Snippet;
		description?: Snippet;
		debug?: boolean;
	}

	let { children, description, debug = false }: Props = $props();
	let toggled: boolean | undefined = $state(undefined);
	const showDebug = $derived(toggled ?? debug);

	let previewEl = $state<HTMLDivElement>();
	let containerEl = $state<HTMLDivElement>();
	let highlighted = $state('');
	let expanded = $state(true);
	let dragging = $state(false);
	let width = $state<number | undefined>(undefined);

	const VOID_ELEMENTS = new Set([
		'area',
		'base',
		'br',
		'col',
		'embed',
		'hr',
		'img',
		'input',
		'link',
		'meta',
		'source',
		'track',
		'wbr'
	]);

	const MIN_WIDTH = 200;

	$effect(() => {
		if (!previewEl) return;
		tick().then(() => {
			const lines = Array.from(previewEl!.childNodes)
				.map((n) => serializeNode(n, 0))
				.filter(Boolean);
			const code = lines.join('\n');
			highlighted = Prism.highlight(code, Prism.languages.markup, 'html');
		});
	});

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		dragging = true;
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		width = Math.max(MIN_WIDTH, e.clientX - rect.left);
	}

	function onPointerUp() {
		dragging = false;
	}

	function resetWidth() {
		width = undefined;
	}

	function cleanAttrs(el: Element): string {
		let out = '';
		for (const attr of el.attributes) {
			if (/^(s|svelte)-/.test(attr.name)) continue;
			if (attr.name === 'role' && attr.value === 'presentation') continue;
			if (attr.name === 'class') {
				const cleaned = attr.value.replace(/\b(s|svelte)-[\w]+/g, '').trim();
				if (cleaned) out += ` class="${cleaned}"`;
				continue;
			}
			out += attr.value === '' ? ` ${attr.name}` : ` ${attr.name}="${attr.value}"`;
		}
		return out;
	}

	function serializeNode(node: Node, indent: number): string {
		if (node.nodeType === Node.COMMENT_NODE) {
			const text = node.textContent?.trim();
			return text ? '  '.repeat(indent) + `<!-- ${text} -->` : '';
		}

		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent?.trim();
			return text ? '  '.repeat(indent) + text : '';
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return '';

		const el = node as Element;
		const tag = el.tagName.toLowerCase();
		const attrs = cleanAttrs(el);
		const pad = '  '.repeat(indent);

		if (VOID_ELEMENTS.has(tag)) return `${pad}<${tag}${attrs}>`;

		const children = Array.from(el.childNodes)
			.map((c) => serializeNode(c, indent + 1))
			.filter(Boolean);

		if (children.length === 0) return `${pad}<${tag}${attrs}></${tag}>`;

		if (
			children.length === 1 &&
			el.childNodes.length === 1 &&
			el.childNodes[0].nodeType === Node.TEXT_NODE
		) {
			return `${pad}<${tag}${attrs}>${el.textContent?.trim()}</${tag}>`;
		}

		return `${pad}<${tag}${attrs}>\n${children.join('\n')}\n${pad}</${tag}>`;
	}
</script>

<div class="preview-block" bind:this={containerEl}>
	{#if description}
		<div class="preview-description">
			{@render description()}
		</div>
	{/if}
	<div class="preview-resize" style:width={width ? `${width}px` : undefined}>
		<div class="preview-render" class:debug={showDebug} bind:this={previewEl}>
			{@render children()}
		</div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="resize-handle"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			ondblclick={resetWidth}
		>
			<span class="resize-grip"></span>
		</div>
		{#if width}
			<span class="resize-label">{Math.round(width)}px</span>
		{/if}
	</div>
	<div class="preview-toolbar">
		<button class="preview-toggle" onclick={() => (toggled = !showDebug)}>
			Outlines: {showDebug ? 'on' : 'off'}
		</button>
		<button class="preview-toggle" onclick={() => (expanded = !expanded)}>
			{expanded ? 'Hide' : 'Show'} Code
		</button>
	</div>
	<div class="preview-code">
		{#if expanded}
			<pre class="language-html"><code class="language-html">{@html highlighted}</code></pre>
		{/if}
	</div>
</div>

<style>
	.preview-block {
		border: 1px solid var(--edge);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.preview-description {
		padding: var(--s-1) var(--s1);
		color: var(--content-1);
		font-size: var(--s-1);
		border-bottom: 1px solid var(--edge);
	}

	.preview-resize {
		position: relative;
		max-width: 100%;
		min-width: 200px;
	}

	.preview-render {
		padding: var(--s1);
		background: var(--base-1);
		overflow: hidden;
	}

	.resize-handle {
		position: absolute;
		top: 0;
		right: 0;
		width: 12px;
		height: 100%;
		cursor: col-resize;
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;

		&:hover .resize-grip,
		&:active .resize-grip {
			opacity: 1;
		}
	}

	.resize-grip {
		width: 4px;
		height: 32px;
		border-radius: 2px;
		background: var(--brand);
		opacity: 0.3;
		transition: opacity 0.15s;
	}

	.resize-label {
		position: absolute;
		bottom: var(--s-3);
		right: var(--s0);
		font-size: var(--s-2);
		font-family: var(--font-mono);
		color: var(--content-1);
		pointer-events: none;
	}

	.debug :global(*) {
		outline: 1px solid oklch(70% 0.15 145 / 0.5);
	}

	.preview-toolbar {
		display: flex;
		border-top: 1px solid var(--edge);
	}

	.preview-code {
		border-top: 1px solid var(--edge);
	}

	.preview-toggle {
		display: block;
		width: 100%;
		padding: var(--s-2) var(--s0);
		font-size: var(--s-1);
		color: var(--content-1);
		text-align: left;
		background: var(--base-2);
		border: none;

		&:hover {
			color: var(--brand);
		}
	}

	pre {
		margin: 0;
		border-radius: 0;
		padding: var(--s0);
		overflow-x: auto;
	}

	code {
		background: none;
		white-space: pre;
	}
</style>
