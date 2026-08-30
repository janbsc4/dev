# Agent Skills and Recipes

My repository with skills, one-time recipes, and other agent tooling.

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

## Skills

Skills are reusable instructions that agents can load when a task calls for them.

| Skill | What it does |
| --- | --- |
| `grill` | Stress-tests a plan, decision, or idea through a structured interview, then records the settled decisions in a numbered plan file. |
| `unslop` | Always running, it makes the output text from agents more bearable and readable. |
| `writing-for-agents` | Guides the creation and revision of skills, agent instruction files, and other documents that agents consume. |
