# NavoPath Style

This document is the source of truth for visual design work in the NavoPath
repository. Read it before changing application, product-site, authentication,
or portfolio interfaces.

## Design Position

NavoPath is an editorial planning tool, not a generic SaaS dashboard.

NavoPath should feel like a clean editorial paper planner rendered as software.
It helps users turn candidate tasks into an executable day through paper-like
structure, precise time layout, and restrained annotation.

Use quiet paper-like surfaces, precise rules, deliberate typography, and
restrained annotation color.

Prefer information hierarchy, spacing, fine rules, and type over stacked cards,
decorative effects, excessive containers, or saturated project colors.

The interface should feel calm enough for planning and precise enough for daily
execution.

NavoPath is not:
- a colorful task dashboard
- a card-heavy project board
- a literal notebook simulation
- a scrapbook interface
- a generic SaaS productivity app

## Brand And Theme

- Core palette: brown `#584D3D`, sage `#7EA172`, coral `#D7816A`, aubergine `#0F0326`, and soft white `#FBF9FF`.
- Light mode uses charcoal `#27231E` as the primary text and ink color. It is not a large filled accent.
- Dark mode uses warm ivory `#EEE9DF` as primary text and as the default interaction accent.
- Execute coral `#D7816A` and Planning sage `#7EA172` are annotation colors for rules, checks, focus, and small status details only.
- Shared application controls must use the active page theme variables, especially `--accent-active`, rather than hard-coded purple or lime.
- Light mode uses charcoal ink on warm soft-white paper.
- Dark mode uses warm ivory ink on charcoal paper.
- Legacy purple and lime remain optional custom accents only.
- Product and portfolio pages map their local accent variables to the shared interaction tokens.

## Annotation Color Usage

NavoPath uses color as annotation, not structure.

The workspace should be built primarily from:

- paper
- ink
- fine rules
- spacing
- typography

Accent and project colors should be used sparingly for:

- categorization
- focus
- current time
- small status details
- checkbox strokes
- thin annotation rules
- tiny project marks

Do not use project colors as the dominant border treatment for task rows,
schedule blocks, shared controls, or layout containers.

A good workspace color balance is approximately:

- 85% paper and ink
- 10% rules, tonal separation, and muted hierarchy
- 5% annotation color

When in doubt, reduce color strength and let spacing, type, and rules carry the
hierarchy.

## Paper Surfaces

- Dark mode uses charcoal paper with warm off-white ink.
- Light mode uses warm ivory paper with charcoal ink.
- Texture is allowed only on large surfaces and must remain extremely subtle.
- Separate regions with whitespace, fine rules, and small tonal shifts.
- Avoid stacked rounded cards, glassmorphism, neon glow, colored shadows, and decorative gradients on controls.
- Paper feeling should come from layout, rules, quiet surfaces, and typography, not from heavy decoration.

## Paper Expression

Paper feeling must come from spacing, rules, quiet surfaces, typography, and
restrained annotation color. It must not depend on heavy skeuomorphic decoration.

The core app workspace should avoid literal notebook or scrapbook styling.

Allowed:

- warm paper-like surfaces
- subtle large-surface texture
- fine ruled lines
- quiet row rhythm
- editorial date typography
- restrained annotation marks
- thin paper-like borders

Avoid:

- binder holes
- torn paper labels
- tape stickers
- stitched notebook seams
- heavy paper grain
- scrapbook decoration
- excessive handwritten effects
- decorative aging, stains, or fake physical artifacts

The interface should feel calm, precise, and software-native, not like a scanned
notebook.

## Typography

- Editorial display type is used for dates, major headings, and selected task titles where the current typography setting permits it.
- Sans-serif type is used for controls and dense operational information.
- Monospace type is reserved for times, indices, compact metadata, and technical labels.
- Button labels stay concise and use medium or semibold weight.
- Do not use display type for operational buttons.
- Do not use strong handwritten styling for operational UI.
- Chinese and English text must remain readable without clipping.
- Editorial typography should create hierarchy, not decoration.

## Workspace Patterns

The main app workspace is the most important expression of the NavoPath style.

It should feel like a quiet paper planner for turning candidate tasks into an
executable day.

The workspace is not a generic card dashboard, project board, or SaaS task
manager.

### Candidate Task List

The candidate list is a task sheet, not a stack of cards.

Candidate tasks must read as quiet list rows on paper.

Use:

- row rhythm
- whitespace
- fine separators
- subtle paper backgrounds
- small annotation marks
- restrained checkbox states
- muted metadata

Avoid:

- thick colored card borders
- stacked rounded cards
- large filled task containers
- saturated project outlines
- colored shadows
- strong hover surfaces
- hover lift or scale

Project color may appear only as:

- a 2px left rule
- checkbox stroke
- tiny project dot
- subtle text accent
- very faint hover wash

Candidate rows should remain visually quieter than scheduled timeline items.
The candidate list is a staging area, not the primary execution surface.

### Schedule Timeline

The schedule timeline is the primary execution surface.

It should feel like ruled paper with precise time structure.

Use:

- thin horizontal time rules
- subtle vertical time axis
- muted hour labels
- generous whitespace
- clear but quiet current-time indication
- low-contrast grid structure

Avoid:

- heavy grid lines
- high-contrast time bars
- calendar blocks that feel like dashboard widgets
- saturated colored rectangles
- thick project-colored outlines

The timeline should communicate time through structure first, color second.

### Scheduled Blocks

Scheduled items should feel like annotated time regions on ruled paper, not
draggable dashboard widgets.

Use:

- very light project-tinted fills
- 1px borders
- subtle left or top annotation rules
- restrained checkbox accents
- calm text hierarchy
- muted metadata when needed

Avoid:

- thick project-colored outlines
- large saturated block fills
- heavy rounded cards
- colored shadows
- glow
- hover lift
- scale animations

Large scheduled blocks must not become visually heavy. Longer duration should
be shown by vertical space, not by stronger color.

### Current Time Indicator

The current time indicator may use coral, but it must stay editorial and
precise.

Use:

- a thin coral rule
- a small time label
- a small dot or pointer only when useful

Avoid:

- thick alert bars
- bright red status styling
- large attention-grabbing markers

The current-time line should guide the eye without dominating the schedule.

### Workspace Controls

Workspace actions such as planning suggestions, add task, filters, and compact
tools should appear as light editorial controls.

Use:

- transparent or lightly tinted surfaces
- thin borders
- concise labels
- small line icons
- active theme variables

Avoid:

- filled capsules
- large pill buttons
- hard-coded purple or lime
- gradients
- glow
- hover lift
- decorative icon containers

Controls should never compete visually with the timeline or task content.

## Button Language

The global button direction is minimal text with a small amount of editorial
annotation texture.

### Primary Annotation

Use for the single most important action in a local context, such as Add, Save,
Register, or Adopt.

- Light active-accent paper tint, active-accent text, and a fine bottom rule.
- Never use a fully filled purple/lime rectangle.
- No gradient, glow, colored shadow, or hover lift.
- Primary controls should still feel like paper annotations, not SaaS buttons.

### Secondary Text

Use for cancel, navigation, filters, and low-priority actions.

- Transparent by default.
- Hover changes ink color and reveals or strengthens a fine rule.
- Do not wrap ordinary secondary actions in pills.
- Keep secondary controls visually quiet.

### Icon Tool

Use for compact workspace tools, close controls, arrows, and utility actions.

- No visible container at rest unless the boundary is required for clarity.
- Hover may use a faint annotation wash and hairline border.
- Icon-only touch targets remain at least 34px on desktop and 44px on touch layouts.
- Icons should be line-based, quiet, and functional.
- Do not use emoji as substitute icons.

### Toggle And Tab

- Selected state uses text color plus a one-pixel active-accent rule.
- Never use a filled segmented-control capsule for selected state.
- Avoid hard filled backgrounds for selection.
- Selection should feel like an editorial mark, not a heavy component state.

### Danger

- Use restrained danger ink and a fine danger rule.
- Do not use a bright solid red control.
- Destructive actions must remain clearly distinguishable from normal actions.
- Danger states must remain accessible, but not visually loud.

## Interaction States

- Default transitions: `150-180ms`, using the shared paper easing curve.
- Hover: ink color, annotation wash, or rule change only.
- Active: `translateY(1px)` only.
- Focus-visible: one-pixel active-accent outline with clear offset.
- Disabled: reduced opacity, no decorative effects, and `not-allowed` cursor.
- Loading: quiet ink-opacity breathing; never glow, bounce, or spin purely for decoration.
- Respect `prefers-reduced-motion`.
- Do not use scale, hover lift, bloom, neon, or decorative bounce.

## Accessibility And Responsive Rules

- Keep readable contrast in both paper themes and all custom accents.
- Do not communicate state with color alone; use rules, labels, icons, or shape.
- Mobile touch targets must be at least 44px.
- Preserve visible keyboard focus.
- Keep labels readable in Chinese and English without clipping.
- Dense task and timeline layouts must remain legible at smaller widths.
- Annotation color must never be the only signal for priority, selection, or completion.

## Product Site And Portfolio Interfaces

Product-site, authentication, and portfolio pages may use stronger editorial
composition than the core app workspace, but they must still follow the same
paper, ink, and annotation principles.

- Use brand color with restraint.
- Avoid generic SaaS landing-page gloss.
- Avoid glassmorphism, neon effects, gradient-heavy buttons, and decorative shadows.
- Product and portfolio pages should feel connected to the core planner, not like a separate brand.

## Forbidden Patterns

- Hover lift or scale.
- Neon or bloom effects.
- Colored drop shadows.
- Gradient button fills.
- Fully filled accent capsules for tabs and toggles.
- Hard-coded purple/lime on shared application controls.
- Emoji used as substitute icons.
- Thick colored outlines on candidate task rows.
- Stacked card-heavy candidate lists.
- Large saturated schedule blocks.
- Project color used as the main structural border.
- Dashboard-style task widgets.
- Overly literal notebook decoration in the core workspace.
- Torn-paper labels in primary app navigation.
- Binder holes, tape, stickers, or scrapbook effects in the main planner.
- Strong handwritten styling for operational UI.
- Any visual treatment that makes the app feel more like a themed dashboard than a quiet paper planner.

## Design Checklist

Before adding or changing a control:

1. Identify whether it is Primary Annotation, Secondary Text, Icon Tool, Toggle/Tab, or Danger.
2. Confirm it reads the correct local or active theme variables.
3. Implement default, hover, active, focus-visible, disabled, and loading states where applicable.
4. Confirm there is no glow, gradient, scale, colored shadow, or hover lift.
5. Verify desktop and mobile target sizes.
6. Check dark/light themes, Execute/Planning accents, and reduced motion.
7. Confirm project color is used as annotation, not structure.
8. Confirm candidate tasks read as quiet rows, not stacked cards.
9. Confirm scheduled blocks read as annotated time regions, not dashboard widgets.
10. Confirm the interface feels like clean paper software, not a literal notebook or generic SaaS dashboard.