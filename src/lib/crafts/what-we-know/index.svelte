<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PassiveCard from './PassiveCard.svelte';
	import PermissionCard from './PermissionCard.svelte';
	import type { PermissionState } from './PermissionCard.svelte';
	import { gatherPassiveData, GROUP_META, deviceClass, type PassiveField } from './gather';
	import LiveTracker from './LiveTracker.svelte';
	import { getServerInfo, type ServerInfo } from './server-info.remote';

	const serverInfo = getServerInfo();
	const data = $derived<ServerInfo>(
		serverInfo.current ?? {
			ip: '—',
			geo: { status: 'fail', message: 'loading' },
			headers: {}
		}
	);

	let clientFields = $state<PassiveField[]>([]);
	let heroTyped = $state('');
	let fullHero = $derived(
		data.geo.status === 'success' && data.geo.city
			? `Hi ${data.geo.city}!`
			: data.geo.country
				? `Hi, visitor from ${data.geo.country}!`
				: `Hi there!`
	);

	// Live reactive fields. viewportW/H and scrollY come from <svelte:window bind:…>;
	// mouse + orientation + docHeight need a tiny bit of glue, but Svelte manages all
	// the window listener lifecycle for us.
	let viewportW = $state(0);
	let viewportH = $state(0);
	let scrollY = $state(0);
	let orientationType = $state<string>('—');
	let mouseX = $state<number | null>(null);
	let mouseY = $state<number | null>(null);
	let docHeight = $state(1);
	let maxTouch = $state(0);

	let scrollPct = $derived(
		docHeight > viewportH ? Math.min(100, (scrollY / (docHeight - viewportH)) * 100) : 0
	);
	let liveDeviceClass = $derived(viewportW > 0 ? deviceClass(maxTouch, viewportW) : '—');

	// rAF-throttle mousemove so state updates stay at ~60 Hz even if the browser
	// dispatches events faster. onmousemove on <svelte:window> hands us the event.
	let pendingMouseX = 0;
	let pendingMouseY = 0;
	let mouseRaf: number | null = null;
	function handleMouseMove(e: MouseEvent) {
		pendingMouseX = e.clientX;
		pendingMouseY = e.clientY;
		if (mouseRaf === null) {
			mouseRaf = requestAnimationFrame(() => {
				mouseX = pendingMouseX;
				mouseY = pendingMouseY;
				mouseRaf = null;
			});
		}
	}

	function refreshDocHeight() {
		docHeight = document.documentElement.scrollHeight;
	}

	function refreshOrientation() {
		orientationType = screen.orientation?.type ?? '—';
	}

	// Live fields count as gathered data points (3 live display fields)
	let liveFieldCount = 3;
	let serverCount = $derived(
		1 + (data.geo.status === 'success' ? 6 : 1) + Object.keys(data.headers).length
	);
	let totalCount = $derived(serverCount + clientFields.length + liveFieldCount);

	function groupedFields(): Record<PassiveField['group'], PassiveField[]> {
		const groups: Record<string, PassiveField[]> = {};
		for (const field of clientFields) {
			(groups[field.group] ||= []).push(field);
		}
		return groups as Record<PassiveField['group'], PassiveField[]>;
	}

	let grouped = $derived(groupedFields());

	onMount(() => {
		clientFields = gatherPassiveData();
		maxTouch = navigator.maxTouchPoints ?? 0;
		refreshOrientation();
		refreshDocHeight();

		// screen.orientation isn't covered by <svelte:window>, so attach manually.
		screen.orientation?.addEventListener?.('change', refreshOrientation);

		// Keep docHeight in sync as content grows/shrinks (e.g. permission cards expanding).
		const bodyObserver = new ResizeObserver(refreshDocHeight);
		bodyObserver.observe(document.documentElement);

		let i = 0;
		const typeInterval = setInterval(() => {
			if (i < fullHero.length) {
				heroTyped = fullHero.slice(0, ++i);
			} else {
				clearInterval(typeInterval);
			}
		}, 55);

		return () => {
			clearInterval(typeInterval);
			screen.orientation?.removeEventListener?.('change', refreshOrientation);
			bodyObserver.disconnect();
			if (mouseRaf !== null) cancelAnimationFrame(mouseRaf);
		};
	});

	// Geolocation
	let geoState = $state<PermissionState>('idle');
	let geoError = $state('');
	let geoCoords = $state<{
		lat: number;
		lng: number;
		accuracy: number;
		alt: number | null;
	} | null>(null);

	async function requestGeo() {
		if (!('geolocation' in navigator)) {
			geoState = 'unsupported';
			return;
		}
		return new Promise<void>((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					geoCoords = {
						lat: pos.coords.latitude,
						lng: pos.coords.longitude,
						accuracy: Math.round(pos.coords.accuracy),
						alt: pos.coords.altitude
					};
					geoState = 'granted';
					resolve();
				},
				(err) => {
					if (err.code === err.PERMISSION_DENIED) geoState = 'denied';
					else {
						geoState = 'error';
						geoError = err.message;
					}
					resolve();
				},
				{ enableHighAccuracy: true, timeout: 10_000 }
			);
		});
	}

	// Media devices
	let mediaState = $state<PermissionState>('idle');
	let mediaError = $state('');
	let mediaDevicesBefore = $state<MediaDeviceInfo[]>([]);
	let mediaDevicesAfter = $state<MediaDeviceInfo[]>([]);
	const MEDIA_PERMISSION_TIMEOUT_MS = 15_000;

	async function requestMedia() {
		if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices.getUserMedia) {
			mediaState = 'unsupported';
			return;
		}
		let stream: MediaStream | null = null;
		const mediaRequest = navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		try {
			mediaDevicesBefore = await navigator.mediaDevices.enumerateDevices();
			stream = await withTimeout(
				mediaRequest,
				MEDIA_PERMISSION_TIMEOUT_MS,
				'The browser did not finish the camera and microphone request. Check the address-bar permissions and try again.'
			);
			stream.getTracks().forEach((track) => track.stop());
			stream = null;
			mediaDevicesAfter = await navigator.mediaDevices.enumerateDevices();
			mediaState = 'granted';
		} catch (err) {
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				mediaState = 'denied';
			} else {
				mediaState = 'error';
				mediaError = err instanceof Error ? err.message : String(err);
			}
		} finally {
			stream?.getTracks().forEach((track) => track.stop());
			// A browser permission sheet can outlive our timeout. If it resolves
			// later, release that stream immediately instead of leaving hardware on.
			void mediaRequest
				.then((lateStream) => {
					lateStream.getTracks().forEach((track) => track.stop());
				})
				.catch(() => undefined);
		}
	}

	function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
		return new Promise((resolve, reject) => {
			const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);

			promise.then(
				(value) => {
					window.clearTimeout(timeout);
					resolve(value);
				},
				(error) => {
					window.clearTimeout(timeout);
					reject(error);
				}
			);
		});
	}

	// Motion / orientation
	let motionState = $state<PermissionState>('idle');
	let motionError = $state('');
	let motionData = $state<{
		alpha: number | null;
		beta: number | null;
		gamma: number | null;
		accelX: number | null;
		accelY: number | null;
		accelZ: number | null;
	}>({ alpha: null, beta: null, gamma: null, accelX: null, accelY: null, accelZ: null });

	function attachMotion() {
		window.addEventListener('deviceorientation', (e) => {
			motionData = {
				...motionData,
				alpha: e.alpha,
				beta: e.beta,
				gamma: e.gamma
			};
		});
		window.addEventListener('devicemotion', (e) => {
			motionData = {
				...motionData,
				accelX: e.accelerationIncludingGravity?.x ?? null,
				accelY: e.accelerationIncludingGravity?.y ?? null,
				accelZ: e.accelerationIncludingGravity?.z ?? null
			};
		});
	}

	async function requestMotion() {
		if (typeof window.DeviceOrientationEvent === 'undefined') {
			motionState = 'unsupported';
			return;
		}
		const orientationCtor = window.DeviceOrientationEvent as unknown as {
			requestPermission?: () => Promise<'granted' | 'denied'>;
		};
		if (typeof orientationCtor.requestPermission === 'function') {
			try {
				const result = await orientationCtor.requestPermission();
				if (result === 'granted') {
					attachMotion();
					motionState = 'granted';
				} else {
					motionState = 'denied';
				}
			} catch (err) {
				motionState = 'error';
				motionError = err instanceof Error ? err.message : String(err);
			}
			return;
		}
		attachMotion();
		motionState = 'granted';
	}

	// Clipboard
	let clipState = $state<PermissionState>('idle');
	let clipError = $state('');
	let clipContent = $state('');

	async function requestClipboard() {
		if (!navigator.clipboard?.readText) {
			clipState = 'unsupported';
			return;
		}
		try {
			const text = await navigator.clipboard.readText();
			clipContent = text || '(empty clipboard)';
			clipState = 'granted';
		} catch (err) {
			if (err instanceof DOMException && err.name === 'NotAllowedError') {
				clipState = 'denied';
			} else {
				clipState = 'error';
				clipError = err instanceof Error ? err.message : String(err);
			}
		}
	}

	const GROUP_ORDER: PassiveField['group'][] = [
		'identity',
		'hardware',
		'display',
		'network',
		'gpu',
		'environment',
		'provenance'
	];

	function fmtCoord(n: number): string {
		return n.toFixed(6);
	}
	function osmUrl(lat: number, lng: number): string {
		const d = 0.005;
		return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
	}
</script>

<svelte:window
	bind:innerWidth={viewportW}
	bind:innerHeight={viewportH}
	bind:scrollY
	onmousemove={handleMouseMove}
/>

<svelte:head>
	<title>What we already know about you</title>
	<meta
		name="description"
		content="An interactive demo showing what any website can learn about you from a single page load, and what changes when you grant browser permissions."
	/>
</svelte:head>

<div class="page">
	<!-- Hero -->
	<section class="hero">
		<div class="eyebrow">
			<Icon icon="lucide:eye" class="ic" />
			<span>No data is logged — this page is a demo.</span>
		</div>
		<h1 class="hero-title">
			<span class="greeting">{heroTyped}</span><span class="caret">|</span>
		</h1>
		<p class="hero-sub">
			You just loaded one page. Here's every single thing your browser and network quietly told us — <strong
				>before</strong
			> you clicked anything.
		</p>
		<div class="counter">
			<span class="n">{totalCount}</span>
			<span class="lbl">data points gathered so far</span>
		</div>
	</section>

	<!-- Server-side passive -->
	<section class="section">
		<header class="section-head">
			<div class="section-icon"><Icon icon="lucide:server" class="ic-lg" /></div>
			<div>
				<h2>From your network request alone</h2>
				<p>Every HTTP request leaks this. You never opted in.</p>
			</div>
		</header>

		<div class="grid">
			<PassiveCard
				icon="lucide:globe"
				label="IP address"
				value={data.ip}
				explanation="Sent with every request you make. Used to look up your rough location below."
				creepy
				delayMs={0}
			/>

			{#if data.geo.status === 'success'}
				<PassiveCard
					icon="lucide:map-pin"
					label="City"
					value={data.geo.city ?? '—'}
					explanation="Resolved from your IP via ip-api.com — no permission required."
					creepy
					delayMs={40}
				/>
				<PassiveCard
					icon="lucide:map"
					label="Region"
					value={data.geo.region ?? '—'}
					explanation="State / province from your IP."
					creepy
					delayMs={80}
				/>
				<PassiveCard
					icon="lucide:flag"
					label="Country"
					value={data.geo.country ?? '—'}
					explanation="Country from your IP."
					delayMs={120}
				/>
				<PassiveCard
					icon="lucide:crosshair"
					label="Approx. coordinates"
					value={data.geo.lat !== null && data.geo.lng !== null
						? `${data.geo.lat?.toFixed(2)}, ${data.geo.lng?.toFixed(2)}`
						: '—'}
					explanation="City-level lat/lng from your IP. Usually accurate to ~10–50 km."
					creepy
					delayMs={160}
				/>
				<PassiveCard
					icon="lucide:wifi"
					label="ISP / network"
					value={data.geo.isp ?? '—'}
					explanation="Who provides your internet connection."
					delayMs={200}
				/>
				<PassiveCard
					icon="lucide:clock"
					label="IP-based timezone"
					value={data.geo.timezone ?? '—'}
					explanation="Inferred from your IP — independent of what your browser reports."
					delayMs={240}
				/>
			{:else}
				<PassiveCard
					icon="lucide:map-pin-off"
					label="Geolocation"
					value="Skipped"
					explanation={data.geo.message ??
						'Running on a local IP — ip-api.com only resolves public addresses.'}
					delayMs={40}
				/>
			{/if}
		</div>

		<details class="raw-headers">
			<summary>Show the raw request headers ({Object.keys(data.headers).length})</summary>
			<pre><code>{JSON.stringify(data.headers, null, 2)}</code></pre>
		</details>
	</section>

	<!-- Client-side passive -->
	<section class="section">
		<header class="section-head">
			<div class="section-icon"><Icon icon="lucide:monitor-smartphone" class="ic-lg" /></div>
			<div>
				<h2>From three lines of JavaScript</h2>
				<p>Any site can read this the moment the page loads. No prompts, no permissions.</p>
			</div>
		</header>

		{#each GROUP_ORDER as group (group)}
			{@const fields = grouped[group] ?? []}
			{#if fields.length}
				<div class="group">
					<h3 class="group-title">
						<Icon icon={GROUP_META[group].icon} class="ic" />
						{GROUP_META[group].label}
						<span class="count">{fields.length}</span>
					</h3>
					<div class="grid">
						{#each fields as field, i (field.key)}
							<PassiveCard
								icon={GROUP_META[group].icon}
								label={field.label}
								value={field.value}
								explanation={field.explanation}
								creepy={field.creepy}
								delayMs={i * 30}
							/>
						{/each}
					</div>
					{#if group === 'display' && viewportW > 0}
						<div class="live-grid grid">
							<PassiveCard
								icon="lucide:maximize-2"
								label="Viewport size"
								value={`${viewportW} × ${viewportH}`}
								explanation="window.innerWidth × window.innerHeight — live. Resize your window to see."
								delayMs={0}
							/>
							<PassiveCard
								icon="lucide:smartphone"
								label="Device class"
								value={liveDeviceClass}
								explanation="Derived live from touch points + current viewport width."
								delayMs={40}
							/>
							<PassiveCard
								icon="lucide:rotate-3d"
								label="Orientation"
								value={orientationType}
								explanation="screen.orientation.type — updates if you rotate your device."
								delayMs={80}
							/>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</section>

	<!-- Permission playground -->
	<section class="section">
		<header class="section-head">
			<div class="section-icon danger"><Icon icon="lucide:key-round" class="ic-lg" /></div>
			<div>
				<h2>Now watch what happens when you click "allow"</h2>
				<p>Tap each prompt to feel the jump from "rough" to "exact".</p>
			</div>
		</header>

		<div class="perm-grid">
			<PermissionCard
				icon="lucide:map-pin"
				title="Precise location"
				description="Turns your city-level IP guess into GPS-accurate coordinates."
				apiSnippet={`navigator.geolocation.getCurrentPosition(
  (pos) => console.log(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
  (err) => console.error(err)
);`}
				buttonLabel="Reveal my exact location"
				ifDenied="Without this, we're stuck with IP geolocation — accurate to your city, not your couch."
				bind:state={geoState}
				bind:errorMessage={geoError}
				onRequest={requestGeo}
			>
				{#if geoCoords}
					<div class="stack">
						<div class="stat-row">
							<span class="key">Latitude</span>
							<span class="mono">{fmtCoord(geoCoords.lat)}</span>
						</div>
						<div class="stat-row">
							<span class="key">Longitude</span>
							<span class="mono">{fmtCoord(geoCoords.lng)}</span>
						</div>
						<div class="stat-row">
							<span class="key">Accuracy</span>
							<span>±{geoCoords.accuracy} m</span>
						</div>
						{#if geoCoords.alt !== null}
							<div class="stat-row">
								<span class="key">Altitude</span>
								<span>{Math.round(geoCoords.alt)} m</span>
							</div>
						{/if}
						<iframe
							class="map"
							title="Your precise location on a map"
							src={osmUrl(geoCoords.lat, geoCoords.lng)}
							loading="lazy"
						></iframe>
						<p class="footnote">
							Compare this to the IP guess above — that was "your city". This is "your roof".
						</p>
					</div>
				{/if}
			</PermissionCard>

			<PermissionCard
				icon="lucide:camera"
				title="Camera & microphone"
				description="Unlocks the exact make and model of every camera and mic attached to your device."
				apiSnippet={`// Before:
await navigator.mediaDevices.enumerateDevices(); // labels are empty strings

// After requesting permission:
await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
await navigator.mediaDevices.enumerateDevices(); // labels now populated`}
				buttonLabel="Allow camera & mic for 1 second"
				ifDenied="Without consent, device labels stay blank — we only know how many you have, not what they are."
				bind:state={mediaState}
				bind:errorMessage={mediaError}
				onRequest={requestMedia}
			>
				{#if mediaState === 'granted'}
					<div class="stack">
						<div class="stat-row">
							<span class="key">Before (no permission)</span>
							<span>{mediaDevicesBefore.length} devices, labels hidden</span>
						</div>
						<div class="stat-row">
							<span class="key">After permission</span>
							<span>{mediaDevicesAfter.length} devices, labels exposed</span>
						</div>
						<ul class="dev-list list-reset">
							{#each mediaDevicesAfter as dev (dev.deviceId || dev.label)}
								<li>
									<span class="kind">{dev.kind}</span>
									<span class="label">{dev.label || '(unnamed)'}</span>
								</li>
							{/each}
						</ul>
						<p class="footnote">
							The camera stream was released immediately — this demo kept nothing.
						</p>
					</div>
				{/if}
			</PermissionCard>

			<PermissionCard
				icon="lucide:compass"
				title="Motion & orientation"
				description="Real-time accelerometer and gyroscope. On iOS, Safari requires an explicit tap."
				apiSnippet={`// iOS 13+ requires this gesture-triggered permission call:
await DeviceOrientationEvent.requestPermission();
window.addEventListener('deviceorientation', (e) => {
  console.log(e.alpha, e.beta, e.gamma);
});`}
				buttonLabel="Stream my device's tilt"
				ifDenied="Without motion access, we can't detect if you're walking, lying down, or rotating."
				bind:state={motionState}
				bind:errorMessage={motionError}
				onRequest={requestMotion}
			>
				{#if motionState === 'granted'}
					<div class="stack">
						<div class="stat-row">
							<span class="key">Alpha (compass)</span>
							<span class="mono"
								>{motionData.alpha !== null ? motionData.alpha.toFixed(1) + '°' : '…'}</span
							>
						</div>
						<div class="stat-row">
							<span class="key">Beta (front/back tilt)</span>
							<span class="mono"
								>{motionData.beta !== null ? motionData.beta.toFixed(1) + '°' : '…'}</span
							>
						</div>
						<div class="stat-row">
							<span class="key">Gamma (left/right tilt)</span>
							<span class="mono"
								>{motionData.gamma !== null ? motionData.gamma.toFixed(1) + '°' : '…'}</span
							>
						</div>
						<div class="stat-row">
							<span class="key">Acceleration (X/Y/Z)</span>
							<span class="mono">
								{motionData.accelX !== null ? motionData.accelX.toFixed(2) : '…'} /
								{motionData.accelY !== null ? motionData.accelY.toFixed(2) : '…'} /
								{motionData.accelZ !== null ? motionData.accelZ.toFixed(2) : '…'}
							</span>
						</div>
						<p class="footnote">
							Tilt your device — the numbers update live. This alone is enough to fingerprint a user
							across sites.
						</p>
					</div>
				{/if}
			</PermissionCard>

			<PermissionCard
				icon="lucide:clipboard"
				title="Clipboard contents"
				description="Read whatever you most recently copied — passwords, addresses, 2FA codes."
				apiSnippet={`const text = await navigator.clipboard.readText();
console.log(text);`}
				buttonLabel="Read my clipboard"
				ifDenied="Good call. This API is the most abused one on the list — and Firefox doesn't even expose it."
				bind:state={clipState}
				bind:errorMessage={clipError}
				onRequest={requestClipboard}
			>
				{#if clipState === 'granted'}
					<div class="stack">
						<p class="key">You last copied:</p>
						<pre class="clip"><code>{clipContent}</code></pre>
						<p class="footnote">
							Imagine a malicious site reading this right after you copied a bank transfer code.
						</p>
					</div>
				{/if}
			</PermissionCard>
		</div>
	</section>

	<!-- Footer -->
	<section class="outro">
		<h2>The point</h2>
		<p>
			Most of this was free. No prompt, no warning, no explicit consent — just the price of opening
			a tab. The interactive cards above show how much more is one click away. Privacy on the web
			isn't about hiding; it's about knowing what you're actually spending.
		</p>
		<p class="small">
			This page ran entirely on your machine, except for the IP geolocation (ip-api.com) used to
			greet you. Nothing is stored. Nothing is logged. Close the tab and it's gone.
		</p>
	</section>
</div>

<LiveTracker {mouseX} {mouseY} {scrollY} {scrollPct} {viewportW} {viewportH} />

<style>
	.page {
		max-width: 72rem;
		margin: 0 auto;
		padding: var(--s2) var(--s0) var(--s3);
		display: flex;
		flex-direction: column;
		gap: var(--s3);
	}

	/* Hero */
	.hero {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-1);
		padding: var(--s2) var(--s0);
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-1);
		border-radius: 999px;
		background: color-mix(in oklch, var(--brand) 10%, transparent);
		color: var(--brand);
		font-size: 0.72rem;
		font-weight: 500;
	}

	.eyebrow :global(.ic) {
		width: 0.85rem;
		height: 0.85rem;
	}

	.hero-title {
		font-size: clamp(2rem, 6vw, 3.75rem);
		font-weight: 700;
		margin: 0;
		line-height: 1.05;
		letter-spacing: -0.02em;
		background: linear-gradient(90deg, var(--brand), var(--content));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.caret {
		font-weight: 300;
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	.hero-sub {
		font-size: clamp(1rem, 2vw, 1.2rem);
		color: var(--content-1);
		max-width: 40rem;
		margin: 0;
		line-height: 1.5;
	}

	.hero-sub strong {
		color: var(--content);
	}

	.counter {
		margin-top: var(--s0);
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-1) var(--s1);
		border: 1px solid var(--edge);
		border-radius: var(--s-1);
		background: var(--base-1);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
	}

	.counter .n {
		font-size: clamp(2rem, 5vw, 3rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--brand);
		line-height: 1;
	}

	.counter .lbl {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--content-1);
	}

	/* Sections */
	.section {
		display: flex;
		flex-direction: column;
		gap: var(--s1);
	}

	.section-head {
		display: flex;
		gap: var(--s-1);
		align-items: flex-start;
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--edge);
	}

	.section-icon {
		padding: var(--s-2);
		border-radius: var(--s-1);
		background: color-mix(in oklch, var(--brand) 12%, transparent);
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}

	.section-icon.danger {
		background: color-mix(in oklch, tomato 18%, transparent);
	}

	.section-icon :global(.ic-lg) {
		width: 1.5rem;
		height: 1.5rem;
		color: var(--brand);
	}

	.section-icon.danger :global(.ic-lg) {
		color: oklch(55% 0.18 25);
	}

	.section-head h2 {
		font-size: clamp(1.2rem, 2.5vw, 1.6rem);
		font-weight: 600;
		margin: 0 0 var(--s-4);
		letter-spacing: -0.01em;
	}

	.section-head p {
		font-size: 0.9rem;
		color: var(--content-1);
		margin: 0;
	}

	/* Groups */
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}

	.group-title {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--content-1);
		margin: 0;
	}

	.group-title :global(.ic) {
		width: 0.95rem;
		height: 0.95rem;
	}

	.group-title .count {
		padding: 0 var(--s-3);
		background: var(--base-2);
		border-radius: var(--s-3);
		font-size: 0.68rem;
		color: var(--content-1);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--s-1);
	}

	.live-grid {
		margin-top: var(--s-1);
		position: relative;
	}

	.perm-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: var(--s0);
	}

	/* Raw headers */
	.raw-headers {
		margin-top: var(--s-1);
	}

	.raw-headers summary {
		cursor: pointer;
		font-size: 0.78rem;
		color: var(--content-1);
	}

	.raw-headers summary:hover {
		color: var(--content);
	}

	.raw-headers pre {
		margin-top: var(--s-2);
		padding: var(--s-1);
		background: var(--base-2);
		border-radius: var(--s-2);
		overflow-x: auto;
		font-size: 0.72rem;
	}

	.raw-headers code {
		font-family: var(--font-mono);
	}

	/* Permission card result slots */
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		gap: var(--s-1);
		font-size: 0.82rem;
	}

	.stat-row .key {
		color: var(--content-1);
	}

	.mono {
		font-family: var(--font-mono);
	}

	.footnote {
		font-size: 0.72rem;
		color: var(--content-1);
		font-style: italic;
		margin: 0;
	}

	.map {
		width: 100%;
		height: 200px;
		border: 1px solid var(--edge);
		border-radius: var(--s-2);
	}

	.dev-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}

	.dev-list li {
		display: flex;
		gap: var(--s-2);
		font-size: 0.78rem;
		padding: var(--s-3) var(--s-2);
		background: var(--base-1);
		border-radius: var(--s-3);
	}

	.dev-list .kind {
		font-family: var(--font-mono);
		color: var(--brand);
		min-width: 6rem;
	}

	.dev-list .label {
		color: var(--content);
		word-break: break-word;
	}

	.clip {
		margin: 0;
		padding: var(--s-1);
		background: var(--base-1);
		border-radius: var(--s-2);
		max-height: 8rem;
		overflow: auto;
		font-size: 0.78rem;
	}

	.clip code {
		font-family: var(--font-mono);
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Outro */
	.outro {
		padding: var(--s2);
		border: 1px solid var(--edge);
		border-radius: var(--s-1);
		background: color-mix(in oklch, var(--brand) 5%, var(--base-1));
		text-align: center;
	}

	.outro h2 {
		font-size: clamp(1.2rem, 2.5vw, 1.5rem);
		font-weight: 600;
		margin: 0 0 var(--s-1);
	}

	.outro p {
		max-width: 42rem;
		margin: 0 auto var(--s-2);
		color: var(--content-1);
		line-height: 1.6;
	}

	.outro .small {
		font-size: 0.78rem;
		opacity: 0.8;
	}
</style>
