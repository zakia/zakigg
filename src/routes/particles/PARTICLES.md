# Particle Systems — How It All Works

## The Big Idea

A particle system is a flipbook. You draw a picture, show it for a split second, erase it, move things slightly, draw it again. Do this 60 times per second and the brain sees motion.

There are only three ingredients:

1. **Particles** — the things that move (a dot, a planet, a snowflake)
2. **Environment** — the world they live in (the canvas, gravity, walls, the mouse cursor)
3. **The Loop** — the clock that keeps everything ticking

---

## The Loop

The loop is the heartbeat of the whole system. Every ~16ms (60fps), it does the same three things in order:

```
┌─────────────────────────────────────────────┐
│  1. CLEAR   — Erase the previous frame      │
│  2. UPDATE  — Move everything (physics)      │
│  3. DRAW    — Paint the new positions        │
│                                              │
│  then repeat forever (requestAnimationFrame) │
└─────────────────────────────────────────────┘
```

### Why this order matters

- If you draw *before* clearing, last frame's image is still there (ghosting).
- If you draw *before* updating, you see where things *were*, not where they *are*.
- Clear → Update → Draw is the universal order for real-time graphics.

### In our code (`createParticleSystem`)

```
createParticleSystem(canvas, {
    clear: 'oklch(15% 0 0)',       ← step 1 (fill with dark color)
    setup(ctx, w, h) { ... },      ← called once at start + on resize
    frame(ctx, w, h, time) { ... } ← steps 2 + 3, called every frame
})
```

The `frame` callback is where *you* decide what update + draw means for your specific effect.

---

## Particle vs Environment

Everything in the system belongs to one of two buckets:

### The Particle (the individual)

A particle only knows about *itself*. It owns:

| Property | What it is | Example |
|---|---|---|
| **Position** | Where it is right now | `x`, `y` |
| **Velocity** | How fast and in what direction it's moving | `vx`, `vy` (or `vector`) |
| **Size** | How big to draw it | `radius` |
| **Mass** | How much it "weighs" (affects gravity) | `mass` |
| **Appearance** | Color, trail history | `hue`, `trailColor` |

A particle has two core methods:

- **`update()`** — Apply velocity to position. "I'm moving at 2px/frame to the right, so my new x = old x + 2." This is physics.
- **`draw()`** — Paint myself on the canvas at my current position. This is rendering.

Think of a particle like a ball on a pool table. The ball knows its position, speed, and color. It does *not* know about the table edges or the other balls — that's the environment's job.

### The Environment (the world)

The environment is everything *outside* the particle that affects it. It's defined in the `setup` and `frame` callbacks of each effect.

| Concept | What it does | Where it lives |
|---|---|---|
| **Canvas** | The rectangle particles live in | `createParticleSystem` sizes it |
| **Walls** | What happens at the edges (bounce? wrap?) | Particle's `update()` checks boundaries |
| **Gravity** | Pulls particles toward each other | `attract()` — particle-to-particle force |
| **Mouse** | Repels or attracts particles near the cursor | `trackMouse()` feeds position into `update()` |
| **Links** | Lines drawn between nearby particles | `frame()` callback checks distances + draws lines |
| **Clear mode** | How the canvas is erased each frame | `clear` option on `createParticleSystem` |

The key insight: **particles own their state, the environment applies forces and rules.**

---

## The Lifecycle

Here's what happens from page load to page leave:

```
Page mounts
  │
  ▼
createParticleSystem(canvas, callbacks)
  │
  ├── resize canvas to fit parent
  ├── call setup() → create all particles
  │
  ▼
loop starts (repeats ~60x/sec)
  │
  ├── 1. Clear canvas
  ├── 2. For each particle:
  │      ├── Apply environment forces (gravity, mouse, etc.)
  │      ├── particle.update() → move position by velocity
  │      └── particle.draw() → paint circle at new position
  ├── 3. Draw environment visuals (links between particles, UI text)
  │
  ▼
  requestAnimationFrame(loop)  ← schedule next frame
  │
  ...repeats until...
  │
Page unmounts
  │
  ▼
cleanup() → cancelAnimationFrame, remove event listeners
```

On **window resize**, the loop pauses, `setup()` is called again (recreates particles for the new size), and the loop restarts.

---

## How the Two Effects Differ

Both effects follow the exact same lifecycle above. The *only* difference is what happens inside `setup` and `frame`:

### Gravity Simulation

| Step | What happens |
|---|---|
| **Setup** | Create a big "sun" particle at center. Create orbiting planets with the right velocity so they orbit (v = sqrt(G * M / r)). |
| **Update** | Every particle pulls on every other particle via gravity (`attract`). Then each particle moves by its velocity. Walls bounce or wrap. |
| **Draw** | Draw each particle as a colored circle. Optionally draw a fading trail behind it. |

### Linked Particles

| Step | What happens |
|---|---|
| **Setup** | Scatter particles randomly. Count is based on canvas area (bigger screen = more particles). |
| **Update** | Each particle drifts at constant speed. Bounces off walls. If the mouse is nearby, gets pushed away. |
| **Draw** | First, draw lines between every pair of particles that are close enough (opacity fades with distance). Then draw each particle as a dot. |

---

## Shared Utilities (`$lib/particles.ts`)

These are the reusable building blocks:

| Export | Type | Purpose |
|---|---|---|
| `createParticleSystem` | function | The loop engine. Handles canvas sizing, clear, animation loop, resize, cleanup. |
| `trackMouse` | function | Attaches mousemove/mouseleave to a canvas. Returns `{ x, y, radius, destroy }`. |
| `distance` | function | Euclidean distance between two points. Used constantly for proximity checks. |
| `MouseState` | interface | Shape of the mouse tracker object (`x?, y?, radius`). |
| `ParticleSystemCallbacks` | interface | Shape of `{ setup, frame, clear }` that you pass to `createParticleSystem`. |
| `GravityParticle` | class | The particle class for the gravity simulation (position, velocity, mass, trails, attract). |
| `GravityConfig` | interface | Settings for the gravity simulation (G, speed, wall behavior, trails). |

---

## Adding a New Effect

1. Create `src/routes/particles/MyEffect.svelte`
2. Define your particle class (position + velocity + update + draw)
3. Call `createParticleSystem(canvas, { setup, frame })` in `onMount`
4. Add it to the `configs` array in `+page.svelte`

The minimum viable effect:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createParticleSystem } from '$lib/particles';

  let canvas = $state<HTMLCanvasElement>();

  onMount(() => {
    if (!canvas) return;
    // your particles array, defined here so setup + frame can both see it
    let dots: { x: number; y: number; vx: number; vy: number }[] = [];

    return createParticleSystem(canvas, {
      setup(_ctx, w, h) {
        dots = Array.from({ length: 100 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        }));
      },
      frame(ctx) {
        for (const d of dots) {
          d.x += d.vx;
          d.y += d.vy;
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  });
</script>

<div class="absolute inset-0">
  <canvas bind:this={canvas}></canvas>
</div>
```

That's it. The framework handles canvas sizing, the animation loop, clearing, resize, and cleanup.
