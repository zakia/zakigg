# Agent Instructions

This file defines how coding agents should work in this repository. Treat it as a living product and engineering constitution: high-signal beliefs first, concrete playbook second.

## Core Beliefs

Core beliefs apply across all work, not only the feature that inspired them.

### One Excellent Version

There is no "simple version" versus "rich version" tradeoff by default. The goal is one excellent version: rich, capable, clean, maintainable, reusable, and pleasant to use.

When a feature feels complicated, do not suggest stripping required capabilities as the first answer. Required user experience, interaction quality, accessibility, polish, and domain behavior are constraints to satisfy, not extras to discard. Simplify the design and implementation while preserving the important behavior.

Default to this question:

> How can this be made cleaner and easier to maintain while still doing everything the experience needs?

Do:

- Preserve essential behavior and craft.
- Reduce accidental complexity rather than product quality.
- Use clear ownership boundaries and reusable pieces.
- Keep implementation approachable without flattening the experience.
- Treat excellent UX and clean code as compatible goals.

Avoid:

- Proposing a stripped-down version when the real problem is messy architecture.
- Treating polish, accessibility, interaction quality, or domain behavior as optional unless the user explicitly makes that tradeoff.
- Splitting features into "simple" and "rich" modes when the request is for one coherent product experience.

## Decision Principles

Use these when values are in tension.

- Prefer removing accidental complexity over removing capability.
- Prefer clearer boundaries over broader rewrites.
- Prefer one reusable, well-shaped surface over parallel components that drift apart.
- Prefer preserving user-facing behavior while improving internals.

## Product Standards

The product should feel intentional, polished, and complete.

- UX quality is part of the requirement, not decoration after the real work.
- Controls should be discoverable, responsive, accessible, and visually consistent with the rest of the app.
- Rich interactions should still feel simple to use.

## Engineering Standards

Code should make the intended experience easier to preserve over time.

- Keep ownership clear: UI components own UI, adapters own integration boundaries, shared services own reusable domain logic.
- Reuse should reduce drift and clarify intent, not create generic abstractions for their own sake.
- Refactors should improve maintainability while keeping behavior intact.

## Collaboration Style

When working with the user:

- Push toward the highest-quality version of the idea, not the smallest version.
- If something feels overcomplicated, first look for a better structure.
- Explain tradeoffs plainly and name the real source of complexity.
- Ask questions when a product value or required behavior is ambiguous.

## Repo Conventions

Add concrete repository-specific rules here as they emerge.

- Svelte components should be shaped around real product ownership, not arbitrary framework boundaries.
- Shared UI should be reused directly when pages and editor surfaces are meant to feel like the same product.

## Workflows

Add repeatable workflows here.

- Before simplifying a feature, identify which behaviors are required and which complexity is accidental.
- Before replacing a component, inspect every current usage and preserve the useful API shape when possible.
- After UI changes, verify the result in the browser when visual layout or interaction behavior matters.

## Examples And Anti-Examples

Use this section for taste calibration.

### Good

- "This implementation is too complex; let's move UI ownership into one clear component while keeping title, language, syntax highlighting, keyboard behavior, copy, and markdown behavior."

### Avoid

- "This is too complex; let's remove title/language/highlighting/keyboard behavior and make a simpler version."
