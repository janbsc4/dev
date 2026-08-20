# Agent skills and recipes

My repository with skills, one-time recipes, and other agent tooling.

These skills are mostly adapted versions of [Matt's](https://github.com/mattpocock/skills/tree/main) and [poteto's](https://github.com/cursor/plugins/tree/main/pstack).

## First-time setup

Clone the repository and enter its root directory:

```bash
git clone https://github.com/janbsc4/dev.git
cd dev
```

Start your agentic coding tool from this directory, then ask it to run the symlink recipe:

```text
Run `recipes/create-skills-symlink.md` from this repository.
```

The recipe will find the agent's user-level skills location, explain the proposed links, and ask for approval before creating them. Keep the cloned repository in place because the installed skills link back to it.

## Recipes

Recipes are procedures meant to be run once to set up or change something. They are not persistent skills and do not need to occupy an agent's context after the work is complete.

For later recipes, give your agent this repository's URL and the exact recipe path. For example:

```text
Use https://github.com/janbsc4/dev and run the recipe at `recipes/create-hook-agent-idle-notification.md`.
```

| Recipe | What it does |
| --- | --- |
| [`create-hook-agent-idle-notification`](recipes/create-hook-agent-idle-notification.md) | Adds a macOS desktop notification and sound when a command-line coding agent finishes a response. |
| [`create-hook-commit-recap`](recipes/create-hook-commit-recap.md) | Creates a session-start hook that detects unseen commits by other authors and offers an on-request recap. |
| [`create-skills-symlink`](recipes/create-skills-symlink.md) | Safely links this repository's skills into a user-selected agent skills location. |

## Skills

Skills are reusable instructions that agents can load when a task calls for them.

| Skill | What it does |
| --- | --- |
| `grill` | Stress-tests a plan, decision, or idea through a structured interview, then records the settled decisions in a numbered plan file. |
| `unslop` | Always running, it makes the output text from agents more bearable and readable. |
| `writing-for-agents` | Guides the creation and revision of skills, agent instruction files, and other documents that agents consume. |
