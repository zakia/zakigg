# Building a Guitar Tuner That Doesn't Jump Around

Ever tried using a guitar tuner app and watched the display flicker wildly between notes? You're playing an E, but it keeps jumping to F#, then back to E, then suddenly shows A for no reason. Frustrating, right?

I set out to build a web-based guitar tuner that actually _stays_ on the note you're playing. Here's the journey, the problems I hit, and how I solved them.

## The Basic Idea

A guitar tuner does one thing: listen to a sound and tell you what note it is. Simple in theory, tricky in practice.

When you pluck a guitar string, it vibrates at a specific frequency. The low E string vibrates about 82 times per second (82 Hz). The tuner's job is to:

1. Listen through your microphone
2. Figure out the frequency of the sound
3. Tell you which note that frequency corresponds to
4. Show you if you're sharp (too high) or flat (too low)

## Version 1: The Naive Approach

My first attempt was straightforward:

- Grab audio from the microphone
- Run a pitch detection algorithm 60 times per second
- Display whatever note it detects

**The problem:** The display was chaos. Even when playing a steady note, the tuner would show E2, then E3, then D#2, then back to E2—all within a second.

Why? Several reasons:

1. **Audio is noisy.** Your microphone picks up room noise, breathing, the refrigerator humming. These interfere with pitch detection.

2. **Pitch detection is imperfect.** The algorithm sometimes gets confused, especially with quiet signals.

3. **Updates were too fast.** Showing a new reading 60 times per second means every tiny fluctuation was visible.

## Version 2: Smoothing Things Out

The first fix was to add **smoothing**—instead of jumping to each new reading, blend the new value with recent readings.

Think of it like this: imagine you're tracking someone's location. If their GPS jumps around erratically, you wouldn't show every jump. You'd average their recent positions to get a smoother path.

I implemented three types of smoothing:

### Exponential Moving Average

Instead of `frequency = newReading`, I used:

```
frequency = frequency + 0.15 × (newReading - frequency)
```

This means the displayed frequency only moves 15% of the way toward each new reading. Sudden jumps get dampened out.

### Median Filtering

I keep the last 5 frequency readings and use the _median_ (middle value) instead of the most recent. This filters out outliers—if four readings say 82 Hz and one random reading says 164 Hz, the outlier gets ignored.

### Note Stability Threshold

I don't change the displayed note until I've seen the _same_ note for 4 consecutive readings. This prevents the display from flickering between adjacent notes like E and F when you're right on the boundary.

**Result:** Much better! The display was calmer. But a new problem emerged...

## The Harmonic Problem

When I played the low E string (E2, 82 Hz), the tuner would correctly show E2 at first. But after a second or two, it would jump to E3 (164 Hz)—exactly one octave higher.

This isn't a bug in my code. It's physics.

### Why Guitar Strings Are Complicated

When you pluck a guitar string, it doesn't just vibrate at one frequency. It vibrates at the **fundamental frequency** (the note you hear) _plus_ a whole series of **harmonics** at 2×, 3×, 4× the fundamental frequency.

```
E2 string vibration:
- Fundamental: 82 Hz (E2) ← the "real" note
- 2nd harmonic: 164 Hz (E3)
- 3rd harmonic: 246 Hz (B3)
- 4th harmonic: 329 Hz (E4)
- ...and so on
```

Here's the kicker: as the string rings out, the **fundamental decays faster** than the harmonics. So after a second or two, the 164 Hz harmonic might actually be _louder_ than the 82 Hz fundamental. The pitch detection algorithm faithfully reports what it hears—which is now E3, not E2.

Professional tuner apps (like the one in my reference screenshot) somehow handle this gracefully. They show E2 and _stay_ on E2 even as the string decays.

## Version 3: Octave Locking

My solution was to implement **octave locking**. The logic goes like this:

1. **During the attack** (when you first pluck and the volume is high), detect the note normally and "lock" it as the reference.

2. **During the decay** (volume is decreasing), be very suspicious of octave jumps. If the algorithm suddenly wants to show E3 when E2 was locked, check: is 164 Hz exactly double 82 Hz? If so, it's probably a harmonic, not a new note.

3. **Correct harmonics back down.** If we detect a frequency that's 2× or 4× the locked frequency during decay, divide it back down.

4. **Reset the lock** when volume drops to silence or suddenly spikes up (indicating a new note was played).

### How I Detect "Decay"

I track the **peak volume** since the note started. If the current volume drops below 70% of that peak, we're in "decay mode" and octave-locking kicks in.

```
Peak volume: 0.8 (when you first plucked)
Current volume: 0.4 (string is ringing out)
0.4 < 0.8 × 0.7 = 0.56 ✓ → We're decaying, lock the octave
```

### Higher Stability Threshold for Octave Changes

Even with octave correction, I added an extra safety measure: during decay, changing to a different octave requires **twice as many** consistent readings (16 instead of 8). This makes the tuner very reluctant to jump octaves while a note is ringing out.

## The Final UI

Beyond stability, I also improved the visual design:

- **Note with octave:** Shows "E2" not just "E"—much more informative
- **Neighboring notes:** A slider showing the previous note, current note, and next note, so you can see where you are in the scale
- **Frequency display:** Shows both your current frequency and the target frequency
- **Volume meter:** A live visualization of input level
- **±10 cents "in tune" zone:** A highlighted green area showing the acceptable range, not just a single point

## What I Learned

1. **Real-world signals are messy.** You can't just naively display sensor data—you need filtering and smoothing.

2. **Domain knowledge matters.** Understanding _why_ harmonics exist and how strings decay was crucial to solving the octave jumping problem.

3. **Professional apps do a lot of invisible work.** That simple-looking tuner on your phone has years of engineering behind it.

4. **Perfect is the enemy of good.** My tuner still occasionally jumps. But it's _dramatically_ better than version 1, and actually usable for tuning a guitar now.

## Technical Details

For those curious about the implementation:

- **Pitch detection algorithm:** Autocorrelation (comparing the signal with delayed versions of itself to find the period)
- **FFT size:** 4096 samples for good low-frequency resolution
- **Frequency range:** Limited to 80-1200 Hz (guitar range) to reduce false positives
- **Framework:** SvelteKit with Svelte 5's runes for reactive state
- **Audio API:** Web Audio API with `getUserMedia` for microphone access

## What's Next

The tuner works, but there's always room for improvement:

- **Better pitch detection:** Could try YIN or pYIN algorithms, which are designed specifically for monophonic (single-note) audio
- **String detection:** Automatically detect which string you're tuning and show the target
- **Temperament options:** Support for different tuning systems beyond equal temperament
- **Visual tuning history:** A graph showing pitch over time

For now, though, I can actually tune my guitar without wanting to throw my laptop out the window. I'll call that a win.
