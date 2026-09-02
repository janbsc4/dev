# Homework

I have to figure out which of these is best:

## Drift (code diverging from docs/conventions/architecture)

- **`drift-detect`** — [rana/skills](https://github.com/rana/skills/blob/main/skills/drift-detect/SKILL.md). The closest match for what you described: compares stated architecture in docs vs. emergent patterns in code, and categorizes each divergence as *accidental* (small PRs that collectively changed the architecture), *intentional but undocumented*, or *contradictory*. Also flags erosion points (crossed module boundaries) and emerging patterns worth codifying. Read-only, report-only.
- **`lifecycle-drift`** — [0xHarbs/agent-setup](https://skillsmp.com/creators/0xharbs/agent-setup/claude-skills-lifecycle-drift). Compares codebase against its own docs, ADRs, and CLAUDE.md conventions; reports violations, stale deps, dead documentation, and schema-code mismatches.
- **`doc-gardener`** — [JanuaryLabs/deepagents](https://skillsmp.com/creators/januarylabs/deepagents/codex-skills-doc-gardener). Doc drift specifically: stale content, broken links, API/behavior drift, metadata/nav drift, with deterministic autofixes and scheduled "gardening" mode.
- **`ctx-drift`** — [ActiveMemory/ctx](https://github.com/ActiveMemory/ctx). Drift in context files themselves — stale paths, broken references, superseded decisions in ARCHITECTURE.md/CONVENTIONS.md.
- **`skill-drift`** (CLI) — [coskunarif/skill-drift](https://github.com/coskunarif/skill-drift). Meta-drift: uses git history to detect when your SKILL.md files themselves have gone stale relative to the code they cover.

## Sediment (cruft, dead code, accreted junk)

- **`cleaning-up-codebases`** — [jonesrussell's writeup](https://jonesrussell.github.io/blog/building-codebase-cleanup-skill-claude-code) with the full SKILL.md inline. Cruft, dead code, scope creep, architectural drift; tiered findings (T1 safe deletes → T4 architectural) and strong anti-over-engineering guardrails. Tested on a live repo in the post.
- **`cleanup-code`** — [ClaudSkills listing](https://claudskills.com/skills/cleanup-code/). 11 dimensions: dead code, duplication, defensive cruft, legacy code, **AI slop**, weak types, with confidence scoring and build/test gates.
- **`dead-code-sweep`** — [petekp/claude-code-setup](https://github.com/petekp/claude-code-setup/blob/main/skills/dead-code-sweep/SKILL.md). Specifically aimed at agent-maintained codebases, with a companion `cruft-patterns.md` detection reference.
- **`unslop-code` + `context-contradiction-checker`** — [Rahul-Krishnan/falcon-skills](https://github.com/Rahul-Krishnan/falcon-skills). The first flags AI-slop patterns (13-pattern taxonomy) with a behavior-verification gate; the second finds contradictions that quietly accumulate across CLAUDE.md, skills, hooks, and settings — context sediment.

Installable via `npx skills add <owner>/<repo> --skill <name>` for most of these. If you want exactly one combo for your stated goal: `drift-detect` + `cleaning-up-codebases` covers both halves well, and both are plain SKILL.md files you can adapt.
