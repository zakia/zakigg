import type { Attachment } from 'svelte/attachments';

let tooltipId = 0;

/** Adds a short, non-interactive description to a button or link. */
export function tooltip(text: string): Attachment<HTMLElement> {
	return (trigger) => {
		const description = document.createElement('div');
		const id = `app-tooltip-${++tooltipId}`;
		const previousDescription = trigger.getAttribute('aria-describedby');
		const controller = new AbortController();
		const { signal } = controller;
		let hideTimer: ReturnType<typeof setTimeout> | undefined;

		description.id = id;
		description.className = 'app-tooltip';
		description.setAttribute('role', 'tooltip');
		description.textContent = text;
		description.hidden = true;
		document.body.append(description);
		trigger.setAttribute('aria-describedby', [previousDescription, id].filter(Boolean).join(' '));

		function place() {
			if (description.hidden) return;
			const anchor = trigger.getBoundingClientRect();
			const bubble = description.getBoundingClientRect();
			const space = 8;
			const list = trigger.closest('dl');
			const leftEdge = list?.getBoundingClientRect().left ?? anchor.left;
			const centeredLeft = Math.max(
				space,
				Math.min(
					window.innerWidth - bubble.width - space,
					anchor.left + anchor.width / 2 - bubble.width / 2
				)
			);
			if (list && leftEdge - bubble.width - space >= space) {
				description.style.left = `${leftEdge - bubble.width - space}px`;
				description.style.top = `${Math.max(space, Math.min(window.innerHeight - bubble.height - space, anchor.top + anchor.height / 2 - bubble.height / 2))}px`;
				description.style.visibility = 'visible';
				return;
			}
			if (list && anchor.bottom + bubble.height + space * 2 <= window.innerHeight) {
				description.style.left = `${centeredLeft}px`;
				description.style.top = `${anchor.bottom + space}px`;
				description.style.visibility = 'visible';
				return;
			}
			const above = anchor.top - bubble.height - space >= space;
			description.style.left = `${centeredLeft}px`;
			description.style.top = `${above ? anchor.top - bubble.height - space : anchor.bottom + space}px`;
			description.style.visibility = 'visible';
		}

		function show() {
			clearTimeout(hideTimer);
			if (description.hidden) {
				description.style.visibility = 'hidden';
				description.hidden = false;
			}
			place();
		}

		function hide() {
			clearTimeout(hideTimer);
			description.hidden = true;
		}

		function hideAfterPointerLeaves() {
			if (document.activeElement === trigger) return;
			hideTimer = setTimeout(hide, 120);
		}

		trigger.addEventListener(
			'pointerenter',
			(event) => {
				if (event.pointerType !== 'touch') show();
			},
			{ signal }
		);
		trigger.addEventListener('pointerleave', hideAfterPointerLeaves, { signal });
		description.addEventListener('pointerenter', show, { signal });
		description.addEventListener('pointerleave', hideAfterPointerLeaves, { signal });
		trigger.addEventListener('focus', show, { signal });
		trigger.addEventListener('blur', hide, { signal });
		trigger.addEventListener(
			'click',
			() => {
				if (trigger instanceof HTMLButtonElement) show();
			},
			{ signal }
		);
		trigger.addEventListener(
			'keydown',
			(event) => {
				if (event.key !== 'Escape' || description.hidden) return;
				event.stopPropagation();
				hide();
			},
			{ signal }
		);
		document.addEventListener(
			'pointerdown',
			(event) => {
				if (!trigger.contains(event.target as Node) && !description.contains(event.target as Node))
					hide();
			},
			{ signal }
		);
		window.addEventListener('resize', place, { signal });
		window.addEventListener('scroll', place, { signal, capture: true });

		return () => {
			clearTimeout(hideTimer);
			controller.abort();
			const remaining = (trigger.getAttribute('aria-describedby') ?? '')
				.split(/\s+/)
				.filter((descriptionId) => descriptionId && descriptionId !== id);
			if (remaining.length) trigger.setAttribute('aria-describedby', remaining.join(' '));
			else trigger.removeAttribute('aria-describedby');
			description.remove();
		};
	};
}
