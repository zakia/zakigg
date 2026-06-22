export function createTimer() {
	let timer: number | undefined;

	function cancel() {
		if (!timer) return;

		window.clearTimeout(timer);
		timer = undefined;
	}

	return {
		schedule(callback: () => void, delay: number) {
			cancel();
			timer = window.setTimeout(() => {
				timer = undefined;
				callback();
			}, delay);
		},

		cancel
	};
}
