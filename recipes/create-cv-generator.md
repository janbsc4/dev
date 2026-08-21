# Recipe: local CV generator

Status: **BETA**. Expect to adapt the implementation to the target website and its build system.

Use this recipe to add a local, editable CV generator to an existing website repository. The result must generate a verified PDF from structured content without publishing the CV through the site's normal build or navigation.

The generator must work from a terminal after setup. Do not make its maintenance depend on a particular model, coding agent, hook system, or session.

## Result

The finished system must:

- keep shared CV content in structured files, with one authoritative source per locale
- keep real contact details and generated output out of version control
- reuse the site's design tokens and licensed local fonts without changing global styles
- expose one documented terminal command for checking, planning, building, verifying, and previewing the CV
- measure real content before pagination and use stable IDs for every indivisible block
- require explicit selection of a persisted page plan for each locale
- fail on stale plans, missing blocks, duplicate blocks, overflow, wrong page geometry, blank pages, clipping, and missing text
- generate self-contained HTML and a fresh PDF without network requests
- render every PDF page to an image and create a labeled contact sheet for human inspection
- leave the site's default build, routes, and navigation unchanged unless the user separately requests publication
- document editing, generation, verification, maintenance, and rollback inside the target repository

## 1. Inspect the target repository

Confirm that the current directory belongs to the website that should receive the CV generator. Find its repository root and inspect:

1. The working-tree status and existing uncommitted changes.
2. The framework, package manager, lockfiles, and runtime versions.
3. The normal build, test, lint, type-check, and preview commands.
4. Existing routes, templates, components, styles, design tokens, and local fonts.
5. Existing command wrappers such as `bin/`, package scripts, or `Makefile` targets.
6. Existing CV, resume, profile, biography, employment, education, and contact sources.
7. Existing ignored paths and any files that the proposed setup could collide with.

Do not clone another repository inside the target. Do not overwrite dirty files or replace project configuration. Show the user the repository root, working-tree state, detected stack, expected file locations, and any collisions before editing.

This step is complete when the host build is reproducible, the integration points are known, and every proposed path is either absent or approved for modification.

## 2. Establish authoritative content

Inventory every plausible source, including structured data, website pages, old CV files, PDFs, and locale-specific documents. Select one authoritative source for each locale with the user.

Keep intentional summaries separate from full career history. Do not expand a summary by inference. Do not invent missing translations. If PDF extraction is needed, use an available text extractor and show uncertain or garbled text to the user before treating it as source data.

Separate content into these categories:

- shared career facts, skills, education, projects, and prose
- locale-specific wording and date formatting
- private contact data
- portrait and other local assets
- presentation rules that belong in code or configuration rather than content

Before implementation, list the chosen locales, authoritative source for each locale, unresolved content conflicts, missing translations, and private fields that require user input.

This step is complete when the user has approved the source and locale map and no generated CV field depends on guessed content.

## 3. Confirm paper and delivery requirements

Ask the user to choose:

1. Paper size and exact dimensions. Offer A4 as a default, not a decision.
2. Portrait or landscape orientation.
3. Top, right, bottom, and left content margins.
4. Required locales.
5. Whether the PDF must build only on the current operating system or on multiple platforms and CI.
6. Whether the CV remains local-only. Local-only is the default.
7. Whether a portrait is required.

Store paper dimensions and margins once in shared configuration. CSS, measurement, page planning, PDF generation, and verification must all read the same values.

Choose a PDF adapter only after the portability requirement is clear:

- A macOS-only implementation may use Swift with WebKit, PDFKit, AppKit, and CoreGraphics.
- A portable or CI implementation may use Playwright with Chromium and Poppler tools.

List every package, browser runtime, system package, or native permission that the chosen path needs. Show the exact installation commands and why they are needed. Obtain approval before installing dependencies, downloading a browser runtime, using a system package manager, or requesting native GUI access.

This step is complete when paper geometry, locale scope, publication boundary, adapter choice, and every dependency change have explicit user approval.

## 4. Create the data and privacy boundary

Use `curriculum/` as the human-editable boundary unless the host has a strong convention that requires another name. Create or adapt this structure:

```text
curriculum/
├── README.md
├── PAGINATION.md
├── config.yml
├── assets/
├── data/
│   └── <locale>.yml
├── page-plan/
│   └── <locale>.yml
├── private.example.yml
├── private.yml          # ignored
└── output/              # ignored
```

Framework adapters, templates, validators, styles, and command wrappers may live in host-conventional directories. Record every such location in `curriculum/README.md`.

### Shared configuration

Put paper dimensions, orientation, margins, supported locales, and schema versions in `config.yml`. Use millimetres for paper and margin values. Reject invalid, missing, negative, or contradictory geometry.

### Locale data

Store non-sensitive content in `data/<locale>.yml` or JSON. Give every semantic block a stable, unique ID. Keep an employment entry, education entry, project, profile paragraph, or skill group whole unless the content schema explicitly defines smaller semantic blocks.

Stable IDs must remain identical in:

- source data
- rendered DOM attributes
- measurement reports
- page-plan files
- validation and overflow errors

Validate required fields, locale identifiers, date formats, unique IDs, section order, and asset references before rendering.

### Private data

Track `private.example.yml` with placeholders. Ignore `private.yml`, which contains real values.

Require a valid email. Treat phone label and phone value as an all-or-nothing optional pair. Validate portrait paths and reject paths outside approved project locations. Do not place private values in test fixtures, expected-text markers, tracked plans, error snapshots, or contact-sheet labels.

If private content affects measurement, include it in the current-run input digest without writing the values into tracked files. Keep any private-data digest or complete render manifest in ignored output.

### Assets

Store portraits, licensed local fonts, and other CV-only assets under `curriculum/assets/` unless the host has an approved asset convention. Confirm that every font license permits repository storage and PDF embedding. Do not load remote fonts or images during measurement or generation.

### Ignored paths

Merge the real private-data and output paths into the existing ignore file. Do not replace unrelated ignore rules. Before continuing, verify that `private.yml`, PDFs, rendered images, reports, and contact sheets are ignored and that no private value is staged.

This step is complete when schemas validate, private data is ignored, local assets are licensed and resolvable, and a maintainer can identify every editable input without reading implementation code.

## 5. Add the host adapter and terminal command

Reuse the website's components, spacing, typography, colors, and content conventions. Keep CV styles scoped to the CV renderer. Do not change global typography or layout merely to make pagination fit.

Add the smallest adapter needed to render structured CV data through the host stack. Keep CV generation outside the site's default route graph and normal build unless the user asks to publish it.

Add one host-conventional terminal entry point, such as `bin/cv`, `npm run cv`, or `make cv`. It must expose these operations with documented locale and path arguments:

```text
cv check     Validate configuration, content, private data, assets, and plans.
cv build     Create measurement artifacts and current pagination reports.
cv plan      Persist one explicitly selected page-plan candidate.
cv verify    Generate fresh HTML and PDF, then run every verification layer.
cv preview   Verify the current run and open only its successful PDF.
```

The command must:

- run without a coding-agent session
- document exit codes and output paths
- distinguish human-readable output from machine-readable reports
- avoid modifying accepted plans during `check`, `build`, `verify`, or `preview`
- avoid opening a stale PDF after a failed build
- return nonzero for invalid data, stale plans, overflow, generation failure, or verification failure

Generate self-contained HTML. Embed approved fonts, styles, and images so measurement and PDF generation make no network requests.

This step is complete when the command runs from a clean terminal, the normal website build remains unchanged, and no CV route appears in public navigation.

## 6. Implement measurement and page planning

Render real locale and private content into a measurement artifact. Do not estimate block heights from character counts or use placeholder text.

Measure every stable semantic block after fonts and images finish loading. Record at least:

- stable block ID
- section and source order
- measured height
- non-breakable or breakable status
- applicable keep-with-next or grouping rule
- input and layout digest

Define page content capacity once:

```text
page capacity = paper height - top content margin - bottom content margin
```

Use the same configured geometry for screen measurement, print CSS, page containers, PDF generation, and verification.

Enumerate valid boundaries between semantic blocks. Reject candidates that duplicate, omit, reorder, or split indivisible blocks. Rank valid candidates using documented balance and grouping criteria, then present the ranked choices to the user. The user must select the accepted plan. Do not silently replace a saved plan.

Persist one plan per locale containing:

- schema version
- locale
- paper and margin configuration digest
- content and layout input digest
- ordered pages
- ordered stable block IDs on each page
- selection timestamp or other non-secret provenance

Build exact page containers from the accepted plan. Fail when the plan is stale, a block is missing or duplicated, order changed, a block exceeds page capacity, or a page overflows. Report the first offending block and overflow in millimetres. Do not reduce font size, line height, or margins automatically to force a fit.

This step is complete when every locale has measured reports, user-reviewed candidates, one accepted plan, and deterministic failures for stale or invalid plans and overflow.

## 7. Implement the PDF adapter

Keep the adapter behind a small interface so it can be replaced without changing content, measurement, planning, or verification contracts.

### Portable adapter

For a portable or CI workflow:

1. Add an exact compatible Playwright version as a development dependency.
2. Commit the package-manager lockfile.
3. Install the matching Chromium runtime only after approval.
4. Use Chromium for measurement and print-to-PDF.
5. Require Poppler tools for PDF metadata, text extraction, and page rendering.
6. Document platform-specific installation commands without running them silently.

### macOS-native adapter

For a macOS-only workflow:

1. Verify Apple developer tools with `xcrun swift --version`.
2. Use WebKit for HTML layout and print generation.
3. Use PDFKit, AppKit, and CoreGraphics for PDF inspection and image output.
4. Set dedicated writable Swift and Clang module caches for generated tooling.
5. Retain WebKit and AppKit objects until asynchronous work completes.
6. Defer cleanup until callbacks and file writes finish.
7. Keep the print worker at its documented default unless measured evidence requires a change.
8. Enforce elapsed-time and intermediate-file-size limits so a stalled render cannot run indefinitely or fill the disk.
9. Remove only known generated artifacts when a limit fires. Never remove source content or user assets.

For either adapter, create a fresh run directory and fresh PDF. A failed generation must not leave an old artifact looking current.

This step is complete when the approved adapter can generate a fresh PDF offline, enforces bounded execution, and can be replaced without changing the neutral data and page-plan formats.

## 8. Verify the generated PDF

`verify` must perform all of these checks on the PDF from the current run:

1. Confirm that a nonempty PDF was created after the run began.
2. Read every media box and compare it with configured paper dimensions using one documented tolerance.
3. Confirm the exact page count from the accepted plan.
4. Extract text from every page and check non-private expected markers.
5. Reject a blank page, missing section, duplicated block, or unexpected page.
6. Detect DOM overflow before PDF creation and clipping indicators after creation.
7. Render every page to PNG.
8. Confirm that each page image contains non-background pixels within the expected content area.
9. Compose one labeled contact sheet containing every page in order.
10. Write a machine-readable verification manifest into ignored output.

Do not downgrade verification to HTML-only checks when PDF inspection tools are absent. Report the missing prerequisite and fail.

A trailing page may be removed only when both extracted-text checks and rendered-pixel checks prove it blank. After removal, run the complete verification sequence again.

`preview` must call the successful verification path first, then open only that run's PDF with the platform viewer command. If opening fails, preserve and print the verified PDF path and return a preview-stage failure.

This step is complete when wrong dimensions, page-count mismatch, missing text, blank pages, clipping, absent renders, and stale artifacts each cause a clear nonzero failure.

## 9. Run project and privacy checks

Exercise every locale with representative content, including:

- the longest expected employment and education entries
- optional phone fields both present and absent
- portrait enabled and disabled when supported
- missing and invalid private data
- stale, incomplete, duplicate, and reordered page plans
- an oversized semantic block
- content that changes a page boundary

Run the host project's existing tests, lint, type checks, and production build. Run `git diff --check`. Inspect the final Git status and confirm:

- `private.yml` is not tracked or staged
- generated HTML, PDFs, images, reports, manifests, and contact sheets are ignored
- no private value appears in tracked files
- the default website build and navigation remain unchanged
- dependency versions are exact and the lockfile is included
- no nested repository or external recipe-source dependency was introduced

This step is complete when every locale passes generation and layered verification, failure fixtures fail for the intended reason, the host checks pass, and the staged diff contains no private or generated data.

## 10. Hand off maintenance and rollback

Present the contact sheet and verified PDF path to the user. Ask the user to inspect the contact sheet. Record whether inspection happened; do not claim visual approval merely because the file exists.

Write `curriculum/README.md` with exact commands for:

1. Editing locale content, private data, portraits, and fonts.
2. Running `check` and reading its reports.
3. Reviewing ranked page-plan candidates.
4. Saving an explicitly selected plan with `plan`.
5. Running `verify` and finding every output artifact.
6. Running `preview`.
7. Running the host project's normal checks.

Write `curriculum/PAGINATION.md` for future maintainers. Explain stable IDs, indivisible blocks, measurement, plan digests, ranked candidates, overflow errors, remeasurement triggers, contact-sheet inspection, and why typography must not be silently shrunk.

List every created or modified file, installed dependency, downloaded runtime, system prerequisite, and ignored path. Provide a rollback plan that removes only files and dependencies added for the CV system. Never include real private data or user-provided assets in an automatic deletion command.

The recipe is complete when a person can update career content, contact details, portrait, and accepted pagination from the documented terminal workflow without touching application code or relying on an agent session.

## Troubleshooting

If content differs between the website and CV, revisit the authoritative-source map instead of merging sources by guesswork. If one locale is incomplete, ask for the missing translation or omit that locale with approval.

If pagination changes between runs, confirm that fonts and images are local, loaded before measurement, and embedded into generated HTML. Check that measurement and PDF generation use the same renderer, geometry, and accepted plan digest.

If a block overflows, improve the content structure or ask the user to choose another valid plan. Do not silently shrink text or margins. If no valid plan exists, report the oversized block and measured excess in millimetres.

If PDF generation hangs or grows without bound, stop the current adapter using its time and size limits, preserve diagnostics, and remove only the known generated artifact. If portable verification tools are missing, show the exact approved installation command and stop.

If the PDF looks correct but verification fails, inspect media-box units, the configured dimension tolerance, and whether the extracted-text markers still match the current content. Fix the check or the content rather than loosening verification until it passes.
