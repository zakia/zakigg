---
title: A little particle playground
slug: particle-playground
description: Notes on the moving dots and pointer interactions on my homepage.
date: 2026-09-30
tags:
  - web
  - fun
id: page_particle_playground
published: true
---

The moving dots on my homepage started as an excuse to learn by building. I wanted the page itself to be part of the experiment: the dots drift behind the introduction and react when you move or press a pointer.

## Giving the dots somewhere to go

Each dot has a position, a velocity, and a radius. On every physics step, its velocity moves it forward. The canvas is resized with the window, and dots bounce when they meet its edges. The **Dots** number in the introduction lets you change how many are in the scene.

## Playing with the field

Moving the pointer pushes nearby dots away. Pressing and holding creates a growing pull. In the full canvas you can change the bounce, dot and link appearance, and the strength of those interactions.

This is still a playground. The interesting part for me is how a few small rules can make a page feel alive. I may revisit collisions with page content as the experiment grows.
