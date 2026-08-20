---
name: setup-symlink
description: Only run when specifically called by name.
---

Expain to the user what running this skill will do and ask if he/she is okay with that, before creating the symlink.

Setup a symlink from this users agents user-level skill folder to the `./skills` folder in this repo.

Detect which agent tool is in use by checking for config directories:
	 - Kiro: `~/.kiro/skills/`
	 - Cursor: `~/.cursor/rules/`
	 - Windsurf: `~/.windsurf/rules/`
	 - Claude Code: `~/.claude/skills/`
	 - If multiple are found, ask the user which one to link.