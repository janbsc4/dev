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
lies about nothing, then start designing.

## Step 1: build the render loop

Done when one command produces a PNG, JPG or similar that you have read with the image tool, and that command also reports the page or frame count.

The page count matters as much as the pixels. A layout that silently spills
onto page 2 looks, on page 1, exactly like a layout whose content vanished.

## Step 2: verify the renderer before you trust it

Done when you can name a region of the current output that the render shows
correctly.

A renderer that produces a plausible but wrong image is worse than no
renderer, because it sends you debugging a layout that was never broken.

## Step 3: read the render and list what is wrong

Done when every item on the checklist below has either a written defect or an
explicit pass.

These are some of the defects that source review cannot catch:

- **Weight hierarchy.** Do headings actually look heavier than body copy? Compare them side by side in the image, not in the code.
- **Baseline alignment.** A date beside a title either shares its baseline or does not. Table columns that align tops instead of baselines drift apart as soon as the two cells differ in size.
- **Contrast in context.** Judge every colour against the background it landed on, not the one you designed it for. An accent that passes on cream fails on a dark strip.
- **Leading consistency.** One paragraph with two line heights reads as broken before a reader can say why.
- **Page overflow.** Content on page 2 of a one-page document.
- **Whitespace balance.** Compare the top margin to the bottom margin, and the length of one column against the other.
- **Artifacts.** A stray rule, a double frame, an orphaned label. These read as bugs even when they were choices.


