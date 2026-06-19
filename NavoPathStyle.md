# NavoPath Style

This document is the source of truth for visual design work in the NavoPath
repository. Read it before changing application, product-site, authentication,
or portfolio interfaces.

## Design Position

NavoPath is an editorial planning tool, not a generic SaaS dashboard.

- Use quiet paper-like surfaces, precise rules, deliberate typography, and
  restrained annotation color.
- Prefer information hierarchy, spacing, and type over stacked cards,
  decorative effects, or excessive containers.
- The interface should feel calm enough for planning and precise enough for
  daily execution.

## Brand And Theme

- Core palette: brown `#584D3D`, sage `#7EA172`, coral `#D7816A`, aubergine `#0F0326`, and soft white `#FBF9FF`.
- Light mode uses charcoal `#27231E` as the primary text and ink color. It is not a large filled accent.
- Dark mode uses warm ivory `#EEE9DF` as primary text and as the default interaction accent.
- Execute coral `#D7816A` and Planning sage `#7EA172` are annotation colors for rules, checks, focus, and small status details only.
- Shared application controls must use the active page theme variables,
  especially `--accent-active`, rather than hard-coded purple or lime.
- Light mode uses charcoal ink on warm soft-white paper. Dark mode uses warm
  ivory ink on charcoal paper. Legacy purple and lime remain optional custom accents.
- Product and portfolio pages map their local accent variables to the shared
  interaction tokens.

## Paper Surfaces

- Dark mode uses charcoal paper with warm off-white ink.
- Light mode uses warm ivory paper with charcoal ink.
- Texture is allowed only on large surfaces and must remain extremely subtle.
- Separate regions with whitespace, fine rules, and small tonal shifts.
- Avoid stacked rounded cards, glassmorphism, neon glow, colored shadows, and
  decorative gradients on controls.

## Typography

- Editorial display type is used for dates, major headings, and selected task
  titles where the current typography setting permits it.
- Sans-serif type is used for controls and dense operational information.
- Monospace type is reserved for times, indices, compact metadata, and technical
  labels.
- Button labels stay concise and use medium or semibold weight. Do not use
  display type for operational buttons.

## Button Language

The global button direction is **minimal text with a small amount of editorial
annotation texture**.

### Primary Annotation

Use for the single most important action in a local context, such as Add, Save,
Register, or Adopt.

- Light active-accent paper tint, active-accent text, and a fine bottom rule.
- Never use a fully filled purple/lime rectangle.
- No gradient, glow, colored shadow, or hover lift.

### Secondary Text

Use for cancel, navigation, filters, and low-priority actions.

- Transparent by default.
- Hover changes ink color and reveals or strengthens a fine rule.
- Do not wrap ordinary secondary actions in pills.

### Icon Tool

Use for compact workspace tools, close controls, arrows, and utility actions.

- No visible container at rest unless the boundary is required for clarity.
- Hover may use a faint annotation wash and hairline border.
- Icon-only touch targets remain at least 34px on desktop and 44px on touch
  layouts.

### Toggle And Tab

- Selected state uses text color plus a one-pixel active-accent rule.
- Never use a filled segmented-control capsule for selected state.

### Danger

- Use restrained danger ink and a fine danger rule.
- Do not use a bright solid red control.
- Destructive actions must remain clearly distinguishable from normal actions.

## Interaction States

- Default transitions: `150-180ms`, using the shared paper easing curve.
- Hover: ink color, annotation wash, or rule change only.
- Active: `translateY(1px)` only.
- Focus-visible: one-pixel active-accent outline with clear offset.
- Disabled: reduced opacity, no decorative effects, and `not-allowed` cursor.
- Loading: quiet ink-opacity breathing; never glow, bounce, or spin purely for
  decoration.
- Respect `prefers-reduced-motion`.

## Accessibility And Responsive Rules

- Keep readable contrast in both paper themes and all custom accents.
- Do not communicate state with color alone; use rules, labels, icons, or shape.
- Mobile touch targets must be at least 44px.
- Preserve visible keyboard focus.
- Keep labels readable in Chinese and English without clipping.

## Forbidden Patterns

- Hover lift or scale.
- Neon or bloom effects.
- Colored drop shadows.
- Gradient button fills.
- Fully filled accent capsules for tabs and toggles.
- Hard-coded purple/lime on shared application controls.
- Emoji used as substitute icons.

## Design Checklist

Before adding or changing a control:

1. Identify whether it is Primary Annotation, Secondary Text, Icon Tool,
   Toggle/Tab, or Danger.
2. Confirm it reads the correct local or active theme variables.
3. Implement default, hover, active, focus-visible, disabled, and loading states
   where applicable.
4. Confirm there is no glow, gradient, scale, or hover lift.
5. Verify desktop and mobile target sizes.
6. Check dark/light themes, Execute/Planning accents, and reduced motion.
