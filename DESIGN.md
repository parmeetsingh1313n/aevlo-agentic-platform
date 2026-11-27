---
name: Aevlo
description: The existing application design system, documented from current source.
colors:
  light-background: "#f6f5f1"
  light-foreground: "#20211f"
  light-card: "#ffffff"
  light-primary: "#e76840"
  light-muted: "#eeede7"
  light-muted-foreground: "#696a64"
  light-border: "#dddcd4"
  dark-background: "#191c1a"
  dark-foreground: "#f3f3ec"
  dark-card: "#242823"
  dark-primary: "#ed946f"
  dark-muted: "#2c312b"
  dark-muted-foreground: "#acb0a5"
  dark-border: "#3e443b"
typography:
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  workspace-title:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  conversation:
    fontFamily: "Manrope, sans-serif"
    fontSize: "13px"
    lineHeight: 1.85
rounded:
  control: "8px"
  avatar: "12px"
  composer: "16px"
spacing:
  tight: "8px"
  group: "12px"
  panel: "20px"
  conversation: "28px"
---

## Overview

This records the coherent existing Aevlo identity; it does not introduce a replacement palette. `app/globals.css`, local font configuration and existing primitives remain the implementation authority. Workspace surfaces serve a task: readability and predictable behavior come first.

## Colors

Use semantic CSS variables for foreground, background, card, muted, border, primary, success and destructive roles. The single terracotta primary color identifies actions and selected state. Both themes keep the same relationships. Never substitute historical blue/amber proposals for the current source tokens.

## Typography

Manrope carries body text and controls. Bricolage Grotesque carries brand lettering and headings. IBM Plex Mono is reserved for code and machine-readable values. Retain local fonts and accessible fallbacks. Workspace headings use a restrained size scale rather than marketing hero typography.

## Layout

The protected workspace uses existing left navigation and a 56px top bar. Agent space gives conversation the flexible column and configuration a 344px column at 1280px, increasing to 380px at 1600px. Below 1280px, configuration opens in a drawer. Transcript and configuration scroll independently; the composer and apply controls stay reachable. Long prose wraps inside its column.

## Elevation & Depth

Use tonal surfaces and full separators for everyday workspace structure. Overlay elevation belongs to drawers and menus. Avoid glow, decorative glass and nested card enclosures on task screens.

## Shapes

Reuse the existing button/input vocabulary. Content radii are modest; the composer is 16px and agent avatars 12–16px. Chat messages may use an asymmetric corner to indicate authorship. Controls retain visible keyboard focus.

## Components

Use existing Base UI-backed primitives for tabs, switches, buttons, inputs and drawers. Tabs have icons plus words and support arrow-key focus/activation. The composer supports multiline text, IME, disabled state and clear local-preview boundaries. Examples and unavailable capabilities must be labeled. Avatar failures show an icon fallback; reduced-motion mode removes the DiceBear animation tag.

## Do's and Don'ts

- Preserve saved identity and server authorization when adding client interactions.
- State whether edits are drafts, applied previews or persisted changes.
- Keep unavailable integrations and schedules truthful and visibly disabled.
- Use short 150–250ms state transitions and respect reduced motion.
- Avoid decorative motion, gradient lettering, fabricated metrics and ambiguous icon-only controls.
