# Agent Skills and Recipes

My repository with skills, one-time recipes, agent tooling, and small scripts.

These skills are mostly adapted versions of [Matt's](https://github.com/mattpocock/skills/tree/main) and [poteto's](https://github.com/cursor/plugins/tree/main/pstack).

## First-time setup

You need git and an agentic coding harness like Claude Code set up.

Clone this repository and enter its root directory:

```bash
git clone https://github.com/janbsc4/dev.git
cd dev
```

Start your agentic coding tool there and ask it to run the symlink recipe:

```text
Run ./recipes/skills-symlinks.md
```

The recipe will find the agent's user-level skills location, explain the proposed links, and ask for approval before creating them. Keep the cloned repository in place because the installed skills link back to it.

Alternatively, install skills without cloning, using the skills CLI. This needs Node.js:

```bash
npx skills add janbsc4/dev              # interactive, pick skills
npx skills add janbsc4/dev --skill grill -g -a opencode -y
```

## Recipes

Recipes are procedures meant to be run once to set up or change something. They are not persistent skills and do not need to occupy an agent's context after the work is complete.

There are two ways to run one.

From this repository's folder, start your agentic coding tool there and give it the recipe path:

```text
Run ./recipes/hook-agent-idle-notification.md
```

The agent reads the file from disk, so this is the option to use when you have already cloned the repository or when you are editing the recipes yourself.

Recipes don't need to be installed locally either. Give your agent this repository's URL and the recipe path:

```text
Use https://github.com/janbsc4/dev and run the recipe at `recipes/hook-agent-idle-notification.md`.
```

| Recipe | What it does |
| --- | --- |
| [`skills-symlinks`](recipes/skills-symlinks.md) | **START HERE:** Finds your agent's user-level skills folder, asks which of this repository's skills you want, and links each selected one. |
| [`hook-agent-idle-notification`](recipes/hook-agent-idle-notification.md) | Adds a macOS desktop notification and sound when a command-line coding agent finishes a response. |
| [`hook-commit-recap`](recipes/hook-commit-recap.md) | Creates a session-start hook that fetches branches, detects unseen work by other authors, and offers a branch-aware recap in the first response. |
| [`add-motion-design`](recipes/add-motion-design.md) | Adds one cohesive motion design pass to a finished website on a new branch, with the focus on choreography, timing, and restraint. |
| [`pidmund`](recipes/pidmund.md) | Installs `pidmund`, a command that opens the most recent assistant response from a pi chat session in the Edmund Markdown editor. |

## Scripts

Standalone command-line scripts live in [`bin/`](bin/). They are installed by their recipes, which check prerequisites and pick an install directory.

| Script | What it does |
| --- | --- |
| [`pidmund`](bin/pidmund) | Opens the last assistant response of the current project's most recent pi session in the Edmund Markdown editor. Run it from any directory where you have chatted with pi. |

## Skills

Skills are reusable instructions that agents can load when a task calls for them.

| Skill | What it does |
| --- | --- |
| `design` | Improves the visual design of anything: builds a render loop and checks what the source alone can't show. Routes website work to `frontend-design`. |
| `frontend-design` | Sub-skill of `design` for building new UI or reshaping existing UI: aesthetic direction, typography, layout, and copy that don't read as templated defaults. |
| `grill` | Stress-tests a plan, decision, or idea through a structured interview, then records the settled decisions in a numbered plan file. |
| `unslop` | Always running, it makes the output text from agents more bearable and readable. |
| `writing-for-agents` | Guides the creation and revision of skills, agent instruction files, and other documents that agents consume. |
