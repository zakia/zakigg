<script lang="ts">
	import { onDestroy } from 'svelte';

	// --- Type Definitions ---
	interface NoteData {
		note: string;
		octave: number;
		cents: number;
		targetFreq: number;
	}

	interface TunerState {
		isRunning: boolean;
		note: string;
		octave: number;
		freq: number;
		targetFreq: number;
		cents: number;
		isClean: boolean;
		confidence: number;
		volume: number;
	}

	// --- Configuration ---
	const A4 = 440;
	const noteStrings: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const IN_TUNE_THRESHOLD = 10; // ±10 cents is considered "in tune"

	// Stabilization settings
	const SMOOTHING_FACTOR = 0.15;
	const NOTE_STABILITY_THRESHOLD = 4;
	const OCTAVE_STABILITY_THRESHOLD = 8; // Higher threshold for octave changes
	const CENTS_SMOOTHING = 0.2;
	const VOLUME_SMOOTHING = 0.3;
	const VOLUME_DECAY_THRESHOLD = 0.7; // If volume drops below this ratio, lock octave

	// --- Svelte 5 State ---
	let tuner = $state<TunerState>({
		isRunning: false,
		note: '-',
		octave: 4,
		freq: 0,
		targetFreq: 0,
		cents: 0,
		isClean: false,
		confidence: 0,
		volume: 0
	});

	// Derived state for neighbor notes
	let neighborNotes = $derived(getNeighborNotes(tuner.note, tuner.octave));

	// --- Audio Variables ---
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let source: MediaStreamAudioSourceNode | null = null;
	let dataArray: Float32Array<ArrayBuffer> | null = null;
	let animationId: number | null = null;

	// --- Smoothing/Stabilization Variables ---
	let smoothedFrequency = 0;
	let smoothedCents = 0;
	let smoothedVolume = 0;
	let previousVolume = 0;
	let peakVolume = 0;
	let currentNoteCandidate = '';
	let currentOctaveCandidate = 4;
	let noteStabilityCount = 0;
	let octaveStabilityCount = 0;
	let lockedNote = '';
	let lockedOctave = 4;
	let lockedFrequency = 0;
	let lastValidFrequency = 0;
	let frequencyHistory: number[] = [];
	const HISTORY_SIZE = 5;

	// Check if two frequencies are harmonically related (one is an octave of the other)
	function isOctaveRelated(freq1: number, freq2: number): boolean {
		const ratio = freq1 > freq2 ? freq1 / freq2 : freq2 / freq1;
		// Check if ratio is close to 2, 4, 0.5, 0.25 (octave relationships)
		return (
			Math.abs(ratio - 2) < 0.1 ||
			Math.abs(ratio - 4) < 0.15 ||
			Math.abs(ratio - 0.5) < 0.05 ||
			Math.abs(ratio - 0.25) < 0.05
		);
	}

	// Check if we're in a "decay" phase (volume decreasing from peak)
	function isDecaying(): boolean {
		return peakVolume > 0.1 && smoothedVolume < peakVolume * VOLUME_DECAY_THRESHOLD;
	}

	// --- Helper to get neighboring notes ---
	function getNeighborNotes(
		note: string,
		octave: number
	): { note: string; octave: number; freq: number }[] {
		if (note === '-') return [];

		const noteIndex = noteStrings.indexOf(note);
		if (noteIndex === -1) return [];

		const result: { note: string; octave: number; freq: number }[] = [];

		// Previous note
		let prevIndex = noteIndex - 1;
		let prevOctave = octave;
		if (prevIndex < 0) {
			prevIndex = 11;
			prevOctave = octave - 1;
		}
		result.push({
			note: noteStrings[prevIndex],
			octave: prevOctave,
			freq: getNoteFrequency(noteStrings[prevIndex], prevOctave)
		});

		// Current note
		result.push({
			note: note,
			octave: octave,
			freq: getNoteFrequency(note, octave)
		});

		// Next note
		let nextIndex = noteIndex + 1;
		let nextOctave = octave;
		if (nextIndex > 11) {
			nextIndex = 0;
			nextOctave = octave + 1;
		}
		result.push({
			note: noteStrings[nextIndex],
			octave: nextOctave,
			freq: getNoteFrequency(noteStrings[nextIndex], nextOctave)
		});

		return result;
	}

	function getNoteFrequency(note: string, octave: number): number {
		const noteIndex = noteStrings.indexOf(note);
		const midiNum = noteIndex + (octave + 1) * 12;
		return 440 * Math.pow(2, (midiNum - 69) / 12);
	}

	// --- Audio Logic ---
	async function startTuner(): Promise<void> {
		if (tuner.isRunning) return;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
			audioContext = new AudioContextClass();

			if (!audioContext) throw new Error('AudioContext not supported');

			analyser = audioContext.createAnalyser();
			analyser.fftSize = 4096; // Increased for better low-frequency detection
			analyser.smoothingTimeConstant = 0.8; // Built-in smoothing

			source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);

			dataArray = new Float32Array(analyser.fftSize);

			// Reset smoothing state
			smoothedFrequency = 0;
			smoothedCents = 0;
			smoothedVolume = 0;
			previousVolume = 0;
			peakVolume = 0;
			currentNoteCandidate = '';
			currentOctaveCandidate = 4;
			noteStabilityCount = 0;
			octaveStabilityCount = 0;
			lockedNote = '';
			lockedOctave = 4;
			lockedFrequency = 0;
			frequencyHistory = [];

			tuner.isRunning = true;
			detectPitch();
		} catch (err) {
			console.error('Microphone error:', err);
			alert('Please allow microphone access.');
		}
	}

	function stopTuner(): void {
		if (source) source.disconnect();
		if (audioContext && audioContext.state !== 'closed') audioContext.close();
		if (animationId !== null) cancelAnimationFrame(animationId);

		tuner.isRunning = false;
		tuner.note = '-';
		tuner.octave = 4;
		tuner.freq = 0;
		tuner.targetFreq = 0;
		tuner.cents = 0;
		tuner.confidence = 0;
		tuner.volume = 0;
	}

	function detectPitch(): void {
		if (!analyser || !dataArray || !audioContext) return;

		analyser.getFloatTimeDomainData(dataArray);

		// Calculate volume (RMS)
		let sumOfSquares = 0;
		for (let i = 0; i < dataArray.length; i++) {
			sumOfSquares += dataArray[i] * dataArray[i];
		}
		const rms = Math.sqrt(sumOfSquares / dataArray.length);
		// Convert to a 0-1 scale (adjust multiplier for sensitivity)
		const rawVolume = Math.min(1, rms * 5);
		previousVolume = smoothedVolume;
		smoothedVolume = smoothedVolume + VOLUME_SMOOTHING * (rawVolume - smoothedVolume);
		tuner.volume = smoothedVolume;

		// Track peak volume for decay detection
		if (smoothedVolume > peakVolume) {
			peakVolume = smoothedVolume;
		}
		// Reset peak when volume drops very low (new note attack)
		if (smoothedVolume < 0.05) {
			peakVolume = 0;
			lockedNote = '';
			lockedOctave = 4;
			lockedFrequency = 0;
		}
		// Also reset if volume suddenly increases (new attack)
		if (smoothedVolume > previousVolume * 1.5 && smoothedVolume > 0.15) {
			peakVolume = smoothedVolume;
			lockedNote = '';
			lockedOctave = 4;
			lockedFrequency = 0;
		}

		const result = autoCorrelate(dataArray, audioContext.sampleRate);
		let frequency = result.frequency;
		const confidence = result.confidence;

		if (frequency === -1) {
			tuner.isClean = false;
			tuner.confidence = 0;
			// Gradually fade cents toward 0 when no signal
			smoothedCents = smoothedCents * 0.9;
			tuner.cents = Math.round(smoothedCents);
		} else {
			// OCTAVE CORRECTION: If we have a locked frequency and the detected frequency
			// is an octave above, correct it back down during decay
			if (lockedFrequency > 0 && isDecaying()) {
				if (isOctaveRelated(frequency, lockedFrequency) && frequency > lockedFrequency) {
					// Detected frequency is likely a harmonic - correct it
					const ratio = frequency / lockedFrequency;
					if (ratio > 1.8 && ratio < 2.2) {
						frequency = frequency / 2; // Correct octave up
					} else if (ratio > 3.6 && ratio < 4.4) {
						frequency = frequency / 4; // Correct two octaves up
					}
				}
			}

			// Add to history for median filtering
			frequencyHistory.push(frequency);
			if (frequencyHistory.length > HISTORY_SIZE) {
				frequencyHistory.shift();
			}

			// Use median of recent readings to filter outliers
			const medianFreq = getMedian([...frequencyHistory]);

			// Exponential moving average for smoothing
			if (smoothedFrequency === 0) {
				smoothedFrequency = medianFreq;
			} else {
				// Adjust smoothing based on how different the new reading is
				const freqDiff = Math.abs(medianFreq - smoothedFrequency) / smoothedFrequency;
				const adaptiveFactor = freqDiff > 0.1 ? SMOOTHING_FACTOR * 2 : SMOOTHING_FACTOR;
				smoothedFrequency = smoothedFrequency + adaptiveFactor * (medianFreq - smoothedFrequency);
			}

			const noteData = getNote(smoothedFrequency);

			// Determine if this is an octave change vs a note change
			const isOctaveChange =
				noteData.note === currentNoteCandidate && noteData.octave !== currentOctaveCandidate;
			const isNoteChange = noteData.note !== currentNoteCandidate;

			// Note stability logic with higher threshold for octave changes during decay
			if (isNoteChange) {
				currentNoteCandidate = noteData.note;
				currentOctaveCandidate = noteData.octave;
				noteStabilityCount = 1;
				octaveStabilityCount = 1;
			} else if (isOctaveChange) {
				// If decaying, require much higher stability for octave changes
				const requiredStability = isDecaying()
					? OCTAVE_STABILITY_THRESHOLD * 2
					: OCTAVE_STABILITY_THRESHOLD;
				octaveStabilityCount++;
				if (octaveStabilityCount >= requiredStability) {
					currentOctaveCandidate = noteData.octave;
					noteStabilityCount = NOTE_STABILITY_THRESHOLD; // Allow immediate update
				}
			} else {
				noteStabilityCount++;
				octaveStabilityCount++;
			}

			// Only update displayed note if we've seen it consistently
			if (noteStabilityCount >= NOTE_STABILITY_THRESHOLD || tuner.note === '-') {
				tuner.note = currentNoteCandidate;
				tuner.octave = currentOctaveCandidate;
				tuner.targetFreq = noteData.targetFreq;

				// Lock the note during the attack phase (high volume, not decaying)
				if (!isDecaying() && smoothedVolume > 0.1) {
					lockedNote = tuner.note;
					lockedOctave = tuner.octave;
					lockedFrequency = smoothedFrequency;
				}
			}

			// Smooth cents display
			smoothedCents = smoothedCents + CENTS_SMOOTHING * (noteData.cents - smoothedCents);

			tuner.isClean = true;
			tuner.cents = Math.round(smoothedCents);
			tuner.freq = smoothedFrequency;
			tuner.confidence = confidence;
			lastValidFrequency = smoothedFrequency;
		}

		if (tuner.isRunning) {
			animationId = requestAnimationFrame(detectPitch);
		}
	}

	function getMedian(arr: number[]): number {
		if (arr.length === 0) return 0;
		const sorted = arr.sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	}

	// --- Math Helpers ---
	function autoCorrelate(
		buffer: Float32Array<ArrayBuffer>,
		sampleRate: number
	): { frequency: number; confidence: number } {
		let sumOfSquares = 0;
		for (let i = 0; i < buffer.length; i++) {
			sumOfSquares += buffer[i] * buffer[i];
		}
		const rms = Math.sqrt(sumOfSquares / buffer.length);
		if (rms < 0.01) return { frequency: -1, confidence: 0 };

		// Trim silence from start and end for better detection
		let start = 0;
		let end = buffer.length - 1;
		const threshold = 0.2;
		for (let i = 0; i < buffer.length / 2; i++) {
			if (Math.abs(buffer[i]) > threshold) {
				start = i;
				break;
			}
		}
		for (let i = buffer.length - 1; i >= buffer.length / 2; i--) {
			if (Math.abs(buffer[i]) > threshold) {
				end = i;
				break;
			}
		}

		const trimmedBuffer = buffer.slice(start, end);
		if (trimmedBuffer.length < 100) return { frequency: -1, confidence: 0 };

		let bestOffset = -1;
		let bestCorrelation = 0;
		let foundGoodCorrelation = false;
		let correlations = new Array(trimmedBuffer.length).fill(0);
		let lastCorrelation = 1;

		// Limit search range based on expected guitar frequencies (80Hz - 1200Hz)
		const minPeriod = Math.floor(sampleRate / 1200); // ~1200Hz max
		const maxPeriod = Math.floor(sampleRate / 80); // ~80Hz min

		for (let offset = minPeriod; offset < Math.min(maxPeriod, trimmedBuffer.length); offset++) {
			let difference = 0;
			for (let i = 0; i < trimmedBuffer.length - offset; i++) {
				difference += Math.abs(trimmedBuffer[i] - trimmedBuffer[i + offset]);
			}
			const correlation = 1 - difference / trimmedBuffer.length;
			correlations[offset] = correlation;

			if (correlation > 0.9 && correlation > lastCorrelation) {
				foundGoodCorrelation = true;
				if (correlation > bestCorrelation) {
					bestCorrelation = correlation;
					bestOffset = offset;
				}
			} else if (foundGoodCorrelation) {
				// Parabolic interpolation for sub-sample accuracy
				if (bestOffset > 0 && bestOffset < correlations.length - 1) {
					const shift =
						(correlations[bestOffset + 1] - correlations[bestOffset - 1]) /
						(2 *
							(2 * correlations[bestOffset] -
								correlations[bestOffset - 1] -
								correlations[bestOffset + 1]));
					if (Math.abs(shift) < 1) {
						bestOffset += shift;
					}
				}
				break;
			}
			lastCorrelation = correlation;
		}

		if (bestCorrelation > 0.8) {
			// Increased threshold for higher confidence
			return {
				frequency: sampleRate / bestOffset,
				confidence: bestCorrelation
			};
		}
		return { frequency: -1, confidence: 0 };
	}

	function getNote(frequency: number): NoteData {
		const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
		const midiNum = Math.round(noteNum) + 69;
		const noteName = noteStrings[midiNum % 12];
		const octave = Math.floor(midiNum / 12) - 1;
		const frequencyOfClosestNote = 440 * Math.pow(2, (midiNum - 69) / 12);
		const cents = Math.round((1200 * Math.log(frequency / frequencyOfClosestNote)) / Math.log(2));

		return { note: noteName, octave, cents, targetFreq: frequencyOfClosestNote };
	}

	onDestroy(() => {
		stopTuner();
	});
</script>

<div class="tuner-container">
	{#if !tuner.isRunning}
		<button onclick={startTuner} class="btn variant-primary"> Start Tuner </button>
	{:else}
		{@const hasSignal = tuner.volume > 0.05}
		<div class="display">
			<!-- Volume meter -->
			<div class="volume-section">
				<span class="volume-label">Volume</span>
				<div class="volume-meter">
					<div class="volume-fill" style="width: {tuner.volume * 100}%"></div>
				</div>
			</div>

			<!-- Main frequency display -->
			<div class="freq-display">
				{#if hasSignal}
					<span class="current-freq" class:in-tune={Math.abs(tuner.cents) <= IN_TUNE_THRESHOLD}>
						{tuner.freq.toFixed(1)} Hz
					</span>
				{:else}
					<span class="current-freq muted">-- Hz</span>
				{/if}
			</div>

			<!-- Cents display -->
			{#if hasSignal}
				<div class="cents-display" class:in-tune={Math.abs(tuner.cents) <= IN_TUNE_THRESHOLD}>
					{tuner.cents > 0 ? '+' : ''}{tuner.cents}¢
				</div>
			{/if}

			<!-- Timeline slider -->
			<div class="timeline">
				<!-- Note labels above track -->
				<div class="timeline-notes">
					{#each neighborNotes as neighbor, i}
						<div class="timeline-note-wrapper" class:active={i === 1}>
							{#if i === 1 && tuner.targetFreq > 0}
								<span class="target-freq">{tuner.targetFreq.toFixed(1)} Hz</span>
							{/if}
							<span
								class="timeline-note"
								class:active={i === 1}
								class:in-tune={i === 1 && hasSignal && Math.abs(tuner.cents) <= IN_TUNE_THRESHOLD}
							>
								{neighbor.note}{neighbor.octave}
							</span>
						</div>
					{/each}
				</div>

				<!-- The track with ticks -->
				<div class="timeline-track">
					<!-- In-tune zone -->
					<div class="in-tune-zone"></div>

					<!-- Tick marks -->
					<div class="timeline-ticks">
						{#each Array(11) as _, i}
							{@const value = (i - 5) * 10}
							<div
								class="tick"
								class:major={value === -50 || value === 0 || value === 50}
								class:center={value === 0}
							></div>
						{/each}
					</div>

					<!-- Needle/indicator (only show if signal) -->
					{#if hasSignal}
						<div
							class="needle"
							style="left: calc(50% + {Math.max(-50, Math.min(50, tuner.cents))}%)"
							class:in-tune={Math.abs(tuner.cents) <= IN_TUNE_THRESHOLD}
						></div>
					{/if}
				</div>

				<!-- Cents labels -->
				<div class="timeline-labels">
					<span>-50</span>
					<span>-40</span>
					<span>-30</span>
					<span>-20</span>
					<span>-10</span>
					<span class="center-label">0</span>
					<span>+10</span>
					<span>+20</span>
					<span>+30</span>
					<span>+40</span>
					<span>+50</span>
				</div>
			</div>

			<button onclick={stopTuner} class="btn variant-base">Stop</button>
		</div>
	{/if}
</div>

<style>
	.tuner-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--s1);
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		width: 100%;
		max-width: 400px;
		margin: var(--s1) auto;
	}

	.display {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--s0);
	}

	/* Volume section */
	.volume-section {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}

	.volume-label {
		font-size: var(--s-1);
		color: var(--content-1);
		min-width: 50px;
	}

	.volume-meter {
		flex: 1;
		height: 6px;
		background: var(--base-2);
		border-radius: 3px;
		overflow: hidden;
	}

	.volume-fill {
		height: 100%;
		background: linear-gradient(to right, var(--success), var(--warning), var(--error));
		transition: width 0.05s linear;
	}

	/* Frequency display */
	.freq-display {
		text-align: center;
	}

	.current-freq {
		font-size: var(--s2);
		font-weight: 600;
		color: var(--content);
		font-variant-numeric: tabular-nums;
		transition: color 0.2s;
	}

	.current-freq.in-tune {
		color: var(--success);
	}

	.current-freq.muted {
		color: var(--content-1);
		opacity: 0.5;
	}

	/* Cents display */
	.cents-display {
		text-align: center;
		font-size: var(--s0);
		font-weight: 600;
		color: var(--error);
		font-variant-numeric: tabular-nums;
		transition: color 0.2s;
	}

	.cents-display.in-tune {
		color: var(--success);
	}

	/* Timeline */
	.timeline {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}

	.timeline-notes {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		padding: 0 var(--s-2);
	}

	.timeline-note-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.timeline-note-wrapper:first-child {
		align-items: flex-start;
	}

	.timeline-note-wrapper:last-child {
		align-items: flex-end;
	}

	.target-freq {
		font-size: var(--s-2);
		color: var(--content-1);
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	.timeline-note {
		font-size: var(--s-1);
		color: var(--content-1);
		font-weight: 500;
		transition: color 0.2s;
	}

	.timeline-note.active {
		font-size: var(--s1);
		font-weight: 700;
		color: var(--content);
	}

	.timeline-note.in-tune {
		color: var(--success);
	}

	.timeline-track {
		position: relative;
		height: 48px;
		background: var(--base-2);
		border-radius: var(--radius);
	}

	.in-tune-zone {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 40%;
		width: 20%;
		background: var(--success);
		opacity: 0.15;
		border-radius: var(--radius);
	}

	.timeline-ticks {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 4px;
	}

	.tick {
		width: 1px;
		height: 12px;
		background: var(--content-1);
		opacity: 0.3;
	}

	.tick.major {
		height: 20px;
		opacity: 0.5;
	}

	.tick.center {
		height: 100%;
		width: 2px;
		background: var(--content);
		opacity: 0.4;
	}

	.needle {
		position: absolute;
		top: 4px;
		bottom: 4px;
		width: 6px;
		background: var(--error);
		border-radius: 3px;
		transform: translateX(-50%);
		transition:
			left 0.12s ease-out,
			background-color 0.2s;
		z-index: 2;
	}

	.needle.in-tune {
		background: var(--success);
	}

	.timeline-labels {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--content-1);
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
	}

	.timeline-labels .center-label {
		font-weight: 600;
		color: var(--content);
		opacity: 1;
	}
</style>
