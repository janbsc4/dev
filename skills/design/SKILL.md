---
name: design
description: Improve the visual design of anything. Use when asked to design, redesign, overhaul the look of something and when a rendered document looks wrong but the source looks correct.
---
A rendered document/website has two representations, and they disagree. Reviewing the source tells you what was requested. Only the render tells you what was implemented.

First, route the work:

- **Website or UI** — load the `frontend-design` skill and follow it for aesthetic direction. The render loop and defect checklist in this file still apply for verification.
- **Print or static document** — continue with Step 1.

Whichever branch you take, the first deliverable is never a design change. It is a **render loop**: one
command that turns the source into an image you look at. Build it, prove it
lies about nothing, prove it's live and doesn't go stale, then start designing.

## Step 1: build the render loop

Done when one command produces a PNG, JPG or similar that you have read with the image tool, and that command also reports the page or frame count.

The page count matters as much as the pixels. A layout that silently spills
onto page 2 looks, on page 1, exactly like a layout whose content vanished.

Step one is often toolchain repair, not design: version pins, a dependency
missing from the runtime, a serve mode that silently freezes. Budget for it,
and once the command works, if it took more than 1 minute to figure out, record the exact invocation in the repo's agent
docs. Offer to either keep or remove this invocation instruction to the user, at the end when the whole design work is finished.

## Step 2: verify the renderer before you trust it

Done when you can name a region of the current output that the render shows
correctly.

A renderer that produces a plausible but wrong image is worse than no
renderer, because it sends you debugging a layout that was never broken.

## Step 3: verify the renderer is live

After building the renderer, make a trivial source change and confirm it appears in the render. Freshness is a separate property from fidelity.

## If the render channel breaks

A degraded loop is legitimate. Fall back to structural verification —
measured geometry, computed contrast — to keep working, and flag the unseen
visuals as debt for a visual re-check before calling the work done.

## Step 4: read the render and list what is wrong

Done when every item on the checklist below has either a written defect or an
explicit pass.

These are some of the defects that source review cannot catch:

- **Weight hierarchy.** Do headings actually look heavier than body copy? Compare them side by side in the image, not in the code.
- **Baseline alignment.** A date beside a title either shares its baseline or does not. Table columns that align tops instead of baselines drift apart as soon as the two cells differ in size.
- **Contrast in context.** Judge every colour against the background it landed on, not the one you designed it for. An accent that passes on cream fails on a dark strip.
- **Leading consistency.** One paragraph with two line heights reads as broken before a reader can say why.
- **Page overflow.** Content on page 2 of a one-page document.
- **Narrow-viewport overflow.** Web layouts fail at small widths in ways a desktop render never shows. Sweep small viewports for horizontal overflow, once per template role. Repeat offenders: a desktop layout rule leaking into the stacked mobile layout, a long word inflating a column's minimum width, a wide table propagating width to ancestors, a nav label outgrowing its bar.
- **Whitespace balance.** Compare the top margin to the bottom margin, and the length of one column against the other.
- **Artifacts.** A stray rule, a double frame, an orphaned label. These read as bugs even when they were choices.
- **Consistent line-height** Make sure that there are no line-height differences between the same paragraph or similar text tags.

## Step 5: render every page role or every document page

Cohesion defects hide in the pages nobody links to. List the distinct page
roles the site actually has — landing, content page, table-heavy,
figure-heavy, error, empty state — and render each at least once.