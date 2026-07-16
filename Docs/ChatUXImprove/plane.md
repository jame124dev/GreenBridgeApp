# Gemini-Inspired Chat UI/UX Specification

> Goal:
> Recreate the premium feel of the Gemini mobile app, not just its appearance. Focus on spacing, motion, typography, animations, and visual hierarchy.

---

# Design Philosophy

The interface should feel:

- Calm
- Premium
- Spacious
- Minimal
- Intelligent
- Soft
- Never cluttered
- Motion first

Avoid making it look like WhatsApp, ChatGPT, Messenger, Discord, or Slack.

Every animation should feel effortless.

---

# Overall Layout

```
Safe Area

Header

(large breathing space)

Messages

(large breathing space)

Input Area
```

There should always be generous whitespace.

Never compress content vertically.

---

# Background

## Default State

Background color:

```
#000000
```

Not pure OLED black if gradients are active.

Use a very subtle dark gradient.

---

## During AI Response

Background should slowly animate.

Transition:

```
Black
↓

Deep Navy

↓

Dark Blue Glow

↓

Soft Purple Tint (very subtle)

↓

Return to Black after completion
```

Do NOT instantly switch colors.

Animation duration:

400–700ms

Use opacity interpolation instead of hard color changes.

---

# Background Animation

The gradient should slowly move upward.

Like light spreading behind the content.

Never flashy.

Never obvious.

Very soft.

Suggested:

- Linear Gradient
- Animated opacity
- Animated translateY
- Reanimated

---

# Header

Minimal.

Contains:

- AI Avatar
- Model Name

No borders.

No shadow.

No background card.

Padding:

Top: 20
Bottom: 24

---

# Messages

Messages should NOT appear inside traditional chat bubbles (AI side).

Gemini mostly displays text directly on the page.

Only user messages are enclosed.

---

# User Bubble

Background:

```
#1C1C1E
```

Radius:

999

Padding:

Horizontal:
20

Vertical:
14

Maximum Width:

72%

Animation:

Fade In

+

Slide Up

6px

Duration:

250ms

---

# AI Message

No visible bubble.

Text placed directly on background.

Large left padding.

Large right padding.

Feels like reading an article.

---

# Typography

Primary Font:

Google Sans

Fallback:

Inter

Fallback:

System

---

# Font Sizes

Body:

17-18

Heading:

28

Caption:

14

Small:

13

---

# Font Weight

Normal:

400

Medium:

500

Bold:

600

Never use heavy bold.

---

# Letter Spacing

Slightly negative.

```
-0.2
```

This makes text look premium.

---

# Line Height

Extremely important.

Use:

31–34

Never use tight spacing.

---

# Paragraph Spacing

Each paragraph:

24px

Example:

Paragraph

(blank)

Paragraph

(blank)

Paragraph

---

# Message Width

Never allow AI text to span full width.

Ideal:

80%

Maximum:

84%

This greatly improves readability.

---

# First AI Message

This is the most important animation.

Sequence:

User presses Send

↓

Background starts glowing

↓

Screen scrolls slightly

↓

AI text fades in

↓

Words begin streaming

↓

Action buttons appear

↓

Glow slowly fades

---

# Streaming

Never stream character-by-character.

Instead:

Word-by-word.

Example:

```
Hello

↓

Hello there,

↓

Hello there, today

↓

Hello there, today we're

↓

Hello there, today we're going
```

Animation speed should vary naturally.

Not perfectly constant.

---

# Streaming Cursor

Use a blinking cursor.

Example:

```
Hello there▌
```

Cursor disappears after completion.

---

# Auto Scroll

During streaming:

Smooth scrolling.

Never jump.

Keep latest sentence visible.

---

# Input Area

Rounded rectangle.

Large corner radius.

Background:

```
#1A1A1A
```

Padding:

16

---

# Input Animation

When user taps:

Input slightly expands.

Scale:

1

↓

1.02

Placeholder fades.

Cursor appears.

---

# Send Button

Hidden while input empty.

Appear only when text exists.

Animation:

Scale

Opacity

Duration:

180ms

---

# Attachment Button

Always visible.

Very subtle.

No background.

---

# Voice Button

Hidden while typing.

Visible when input empty.

Crossfade with Send button.

---

# AI Action Row

Should NOT appear immediately.

Delay:

300ms

Icons:

Like

Dislike

Copy

Share

Speak

More

Animation:

Fade

+

Slide Up

---

# Thinking State

Before response begins:

Display

```
Thinking...
```

or

Animated dots.

Three dots should pulse.

Not bounce.

---

# Scrolling Physics

Smooth.

iOS-like.

No sudden acceleration.

---

# Shadows

Avoid heavy shadows.

Instead use:

Very soft glow.

Almost invisible.

---

# Colors

Primary Background

```
#000000
```

Input

```
#1A1A1A
```

User Bubble

```
#1C1C1E
```

Primary Text

```
#FFFFFF
```

Secondary Text

```
#A8A8A8
```

Accent

```
#5C7CFA
```

Glow

```
rgba(92,124,250,0.18)
```

---

# Motion Principles

Every movement should:

- Ease Out
- Soft
- Slow
- Organic

Never bounce.

Never overshoot.

Never feel mechanical.

---

# Timing

Tiny Animation

150ms

Normal

250ms

Large

400ms

Background

600ms

---

# Screen Transition

Push transition.

Slight fade.

No dramatic slide.

---

# Haptics

Send Message

Light Impact

Response Finished

Soft Selection

Error

Warning

---

# Markdown Rendering

Support:

- Headings
- Bullet Lists
- Numbered Lists
- Code Blocks
- Inline Code
- Tables
- Quotes
- Links

Typography should remain consistent.

---

# Code Blocks

Rounded corners.

Dark background.

Horizontal scrolling.

Copy button.

Language badge.

---

# Images

Rounded corners.

Tap to fullscreen.

Smooth zoom animation.

---

# Loading Indicator

Never spinner.

Use:

Animated dots

or

Gradient shimmer.

---

# Empty State

Center logo.

Large spacing.

Suggested prompts.

No clutter.

---

# Performance

- Use FlashList
- Memoized Message Components
- Reanimated Worklets
- Virtualized Rendering
- Stream updates without rerendering whole list

---

# Accessibility

Minimum touch target:

44x44

Support Dynamic Font Size.

Respect reduced motion settings.

---

# React Native Recommended Stack

- Expo
- NativeWind
- React Native Reanimated
- React Native Gesture Handler
- FlashList
- Expo Blur
- React Native SVG
- React Native Skia (optional)
- react-native-markdown-display
- react-native-haptic-feedback
- expo-linear-gradient

---

# Things to Avoid

❌ Heavy shadows

❌ Bright gradients

❌ ChatGPT-style bubbles

❌ Tight spacing

❌ Character-by-character typing

❌ Fast animations

❌ Full-width text

❌ Overuse of borders

❌ Too many colors

❌ Large icons

❌ Material cards everywhere

---

# Final Feeling Checklist

The app should feel:

☐ Calm

☐ Spacious

☐ Premium

☐ Elegant

☐ Intelligent

☐ Lightweight

☐ Fast

☐ Smooth

☐ Human

☐ Invisible UI

If the user notices the animations, they are probably too strong.

The interface should disappear and let the conversation become the focus.