import type { Attachment } from 'svelte/attachments';

/** Copies the current value when a button is pressed and shows nearby feedback. */
export function copyToClipboard(
	getText: () => string,
	label = 'Text'
): Attachment<HTMLButtonElement> {
	return (trigger) => {
		const feedback = document.createElement('span');
		const announcement = document.createElement('span');
		const controller = new AbortController();
		const { signal } = controller;
		let hideTimer: ReturnType<typeof setTimeout> | undefined;
		let disposed = false;

		feedback.className = 'app-copy-feedback';
		feedback.hidden = true;
		feedback.setAttribute('aria-hidden', 'true');
		announcement.className = 'sr-only';
		announcement.setAttribute('role', 'status');
		document.body.append(feedback, announcement);

		function place() {
			if (feedback.hidden) return;
			const anchor = trigger.getBoundingClientRect();
			const bubble = feedback.getBoundingClientRect();
			const margin = 8;
			const x = Math.max(
				margin,
				Math.min(
					window.innerWidth - bubble.width - margin,
					anchor.left + (anchor.width - bubble.width) / 2
				)
			);
			const above = anchor.top - bubble.height - margin;
			const y = above >= margin ? above : anchor.bottom + margin;
			const top = Math.max(margin, Math.min(window.innerHeight - bubble.height - margin, y));
			feedback.style.left = `${x}px`;
			feedback.style.top = `${top}px`;
		}

		async function copy() {
			const value = getText();
			announcement.textContent = '';
			try {
				await navigator.clipboard.writeText(value);
				if (disposed) return;
				feedback.textContent = 'Copied';
				announcement.textContent = `${label} copied`;
			} catch {
				if (disposed) return;
				feedback.textContent = 'Could not copy';
				announcement.textContent = `Could not copy ${label.toLowerCase()}`;
			}
			feedback.hidden = false;
			place();
			clearTimeout(hideTimer);
			hideTimer = setTimeout(() => {
				feedback.hidden = true;
				announcement.textContent = '';
			}, 1800);
		}

		trigger.addEventListener('click', copy, { signal });
		window.addEventListener('resize', place, { signal });
		window.addEventListener('scroll', place, { signal, capture: true });

		return () => {
			disposed = true;
			clearTimeout(hideTimer);
			controller.abort();
			feedback.remove();
			announcement.remove();
		};
	};
}
