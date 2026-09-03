# Agent Skills and Prompt Templates

My repository with skills, prompt templates, other agent tooling, and small scripts.

These skills are mostly adapted versions of [Matt's](https://github.com/mattpocock/skills/tree/main) and [poteto's](https://github.com/cursor/plugins/tree/main/pstack).

## First-time setup

You need git and an agentic coding harness set up. The prompt templates below are written in [pi's prompt-template format](https://pi.dev/docs/latest/prompt-templates); other harnesses with a compatible Markdown command format, like Claude Code, can run them from the file path.

Clone this repository and enter its root directory:

```bash
git clone https://github.com/janbsc4/dev.git
cd dev
```

Start your agentic coding tool there and run the setup template. With pi, start it with the template loaded and type:

```text
pi --prompt-template prompts/skills-symlinks.md
/skills-symlinks
```

With other harnesses, give it the file path:

```text
Run ./prompts/skills-symlinks.md
```

The template will find your agent's user-level skills and prompt-template locations, explain the proposed links, and ask for approval before creating them. Keep the cloned repository in place because the installed skills and templates link back to it.

Alternatively, install skills without cloning, using the skills CLI. This needs Node.js:

```bash
npx skills add janbsc4/dev              # interactive, pick skills
npx skills add janbsc4/dev --skill grill -g -a opencode -y
```

## Prompt templates

Templates are procedures meant to be run once to set up or change something. They are not persistent skills and do not need to occupy an agent's context after the work is complete. Each file in `prompts/` expands into a full prompt when you type `/name`, where `name` is the file name without `.md`.

There are two ways to run one.

Point pi at the file when starting it, then type the command:

```text
pi --prompt-template prompts/hook-agent-idle-notification.md
/hook-agent-idle-notification
```

To use them in any project, install them globally: run `/skills-symlinks` once and include the prompt templates in your selection, or link them by hand into pi's global location:

```bash
mkdir -p ~/.pi/agent/prompts
ln -s "$PWD/prompts/"*.md ~/.pi/agent/prompts/
```

Templates don't need to be installed either. Give your agent this repository's URL and the template path:

```text
Use https://github.com/janbsc4/dev and run the prompt template at `prompts/hook-agent-idle-notification.md`.
```

| Template | What it does |
| --- | --- |
| [`skills-symlinks`](prompts/skills-symlinks.md) | **START HERE:** Finds your agent's user-level skills and prompt-template folders, asks which of this repository's items you want, and links each selected one. |
| [`hook-agent-idle-notification`](prompts/hook-agent-idle-notification.md) | Adds a macOS desktop notification and sound when a command-line coding agent finishes a response. |
| [`hook-commit-recap`](prompts/hook-commit-recap.md) | Creates a session-start hook that fetches branches, detects unseen work by other authors, and offers a branch-aware recap in the first response. |
| [`add-motion-design`](prompts/add-motion-design.md) | Adds one cohesive motion design pass to a finished website on a new branch, with the focus on choreography, timing, and restraint. |
| [`pidmund`](prompts/pidmund.md) | Installs `pidmund`, a command that opens the most recent assistant response from a pi chat session in the [Edmund Markdown editor](https://github.com/I7T5/Edmund). |

## Scripts

Standalone command-line scripts live in [`scripts/`](scripts/). They are installed by their templates, which check prerequisites and pick an install directory.

| Script | What it does |
| --- | --- |
| [`pidmund`](scripts/pidmund) | Opens the last assistant response of the current project's most recent pi session in the Edmund Markdown editor. Run it from any directory where you have chatted with pi. |

## Skills

Skills are reusable instructions that agents can load when a task calls for them.

| Skill | What it does |
| --- | --- |
| `design` | Improves the visual design of anything: builds a render loop and checks what the source alone can't show. Routes website work to `frontend-design`. |
| `frontend-design` | Sub-skill of `design` for building new UI or reshaping existing UI: aesthetic direction, typography, layout, and copy that don't read as templated defaults. |
| `grill` | Stress-tests a plan, decision, or idea through a structured interview, then records the settled decisions in a numbered plan file. |
| `unslop` | Always running, it makes the output text from agents more bearable and readable. |
| `writing-for-agents` | Guides the creation and revision of skills, agent instruction files, and other documents that agents consume. |
