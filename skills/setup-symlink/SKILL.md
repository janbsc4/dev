---
name: setup-symlink
description: Setup a symlink from this agents user-level skill folder to the skills folder in this repo
---

Setup a symlink from this users agents user-level skill folder to the `./skills` folder in this repo.

Detect which agent tool is in use by checking for config directories:
	 - Kiro: `~/.kiro/skills/`
	 - Cursor: `~/.cursor/rules/`
	 - Windsurf: `~/.windsurf/rules/`
	 - Claude Code: `~/.claude/skills/`
	 - If multiple are found, ask the user which one to link.