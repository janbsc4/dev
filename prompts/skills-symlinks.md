---
description: Install skills and prompt templates from this repository into an agent's user-level directories via symlinks
---
Install skills and prompt templates from a persistent clone of this repository into a coding agent's user-level directories. Each selected item gets its own symbolic link, so editing the clone updates the installed copy.

Run it once per agent installation. Run it again later to add items you skipped the first time.

## Result

The finished setup must:

- detect the user-level skills and prompt-template directories of installed agents
- ask which agent or directory to install into when it finds more than one
- present every available skill and prompt template with its name and description
- let the user choose any subset, including all of them
- create one symbolic link per selected item, pointing into this repository's `skills/` or `prompts/` directory
- leave unselected items uninstalled
- preserve every existing file, directory, and unrelated link
- use absolute paths so links do not depend on the working directory
- verify that each new link resolves to the intended skill or template
- report the exact rollback command for each link you create

## 1. Resolve the sources

Locate the persistent clone of this repository. If the current working directory is the clone, use it; otherwise ask the user for the clone's path. Resolve it to an absolute canonical path. The source directories are `<repository>/skills` and `<repository>/prompts`.

Collect every direct child directory of `skills/` that contains a readable `SKILL.md`, and every direct child `.md` file of `prompts/` as a prompt template. Ignore other files and directories, including `.DS_Store` and supporting documents inside a skill folder.

Confirm that the clone is in a permanent location. The links break if the repository later moves or disappears, so a temporary checkout is not a valid source.

This step is complete when you know the absolute source paths and have found at least one installable item: a skill directory with a readable `SKILL.md`, or a template `.md` file.

## 2. Find candidate agent directories

Check for these user-level locations, which are the common ones:

Skills directories:

```text
~/.kiro/skills/
~/.claude/skills/
~/.cursor/rules/
~/.windsurf/rules/
~/.codex/skills/
~/.agents/skills/
```

Prompt-template directories:

```text
~/.pi/agent/prompts/
~/.claude/commands/
~/.config/opencode/command/
```

Treat a path as a candidate when it exists, or when its parent agent directory exists and the agent documents that path. A missing parent usually means the agent is not installed, so do not create directories for agents the user does not have.

Then resolve the ambiguity for each kind separately:

- **One candidate.** Name it and continue.
- **Several candidates.** List them and ask the user which to install into. Do not pick for them, and do not install into all of them unless the user says so.
- **No candidates.** Ask the user for the agent's documented user-level path.

A directory is only a candidate. Before using a skills directory, confirm the agent loads skills as child directories containing `SKILL.md`; a rules directory that expects single Markdown files will not load this layout, and linking into it produces no working skills. Before using a prompt-template directory, confirm the agent loads flat `.md` files from it as prompt templates or slash commands; a skills directory that expects `SKILL.md` child directories will not load linked template files.

This step is complete when you have one destination directory for every kind you are installing and have confirmed each loads the matching layout.

## 3. Present the items and ask which to install

Read the YAML frontmatter of each `SKILL.md` and each template and extract `name` and `description`. Fall back to the directory or file name when `name` is missing, and to the first meaningful line of the body when `description` is missing.

Show a numbered table so the user can choose by number or name:

```text
Available in /absolute/path/to/repository

  Skills
  #  Skill               Description
  1  grill               Grill the user relentlessly about a plan, decision, or idea.
  2  unslop              Cut AI tells from any writing. Must always apply.
  3  writing-for-agents  Write and edit documents for agents.

  Prompt templates
  #  Template           Description
  4  add-motion-design  Add one cohesive motion design pass to a finished website.

Already installed: (none)

Which items should I install?
Reply with numbers (for example: 1 4), names, or "all".
```

Shorten a long description to one line in the table. Mark any item that already links correctly as installed and leave it out of the default selection. Also mark items you cannot link because something already occupies the destination, and say what occupies it.

Accept numbers, names, and `all`. Confirm the parsed selection back to the user before touching the filesystem, and stop if any entry is ambiguous or unrecognized rather than guessing which item was meant.

This step is complete when the user has an explicit list of items to install and has confirmed the list you echoed back.

## 4. Inspect each destination for conflicts

For every selected item, the destination is:

```text
<destination-directory>/<skill-name-or-template-filename>
```

Inspect each destination without following symbolic links, and classify it:

- **Absent.** Ready to link.
- **Link to the intended item.** Already installed; skip it and report it as already done.
- **Link to another location.** Skip it and ask the user before changing it.
- **Broken link.** Skip it and ask before replacing it.
- **Regular file or directory.** Skip it. Do not delete, move, merge, or overwrite real content.

Create the destination directory only when the agent documents that path and the user approves.

Show the user, before any change:

- the chosen agent and destination directories
- each source and destination pair as absolute paths
- every skipped destination and its reason
- whether the agent needs a restart or reload afterward
- the rollback command for each link you will create

Then ask for approval. Asking for this template is not approval to overwrite an occupied path.

This step is complete when every selected item is either ready to link or explicitly skipped, and the user has approved the exact list.

## 5. Create the links

Create one link per approved item. Quote both paths and do not use force flags:

```bash
ln -s "/absolute/path/to/repository/skills/grill" "$HOME/.kiro/skills/grill"
ln -s "/absolute/path/to/repository/prompts/add-motion-design.md" "$HOME/.pi/agent/prompts/add-motion-design.md"
```

If a command fails, stop and reinspect that destination before retrying. Never delete a path just because linking failed.

This step is complete when every approved link exists and no skipped or unapproved path changed.

## 6. Verify and record rollback

For each installed item:

1. Confirm the destination is a symbolic link.
2. Resolve it and compare the canonical target with the intended skill directory or template file.
3. Confirm the entry point (`SKILL.md` for a skill, the `.md` file for a template) is readable through the link.

Then restart or reload the agent if required, and have it list or invoke one installed item through its normal mechanism. A link that resolves correctly but never loads usually means the destination format was wrong, so return to step 2.

Rollback removes only the link:

```bash
rm -- "$HOME/.kiro/skills/grill"
```

Verify the path is still a link before removing it. Never use a trailing slash and never use recursive deletion. Removing a link must leave the repository untouched.

Report the installed items, their destinations, the skipped ones with reasons, and the rollback commands.

The work is complete when the agent loads every selected item, each link resolves to this repository, and the user has the rollback commands.

## Troubleshooting

If the agent shows no skills, confirm the destination loads `SKILL.md` directories rather than flat rule files, then check link resolution, permissions, and whether the agent needs a reload. If a linked template does not appear as a command, confirm the destination loads flat `.md` files as prompt templates or slash commands, then check the same things.

If an item name collides with one the user already wrote, keep theirs. Ask whether to rename the incoming link, and remember that a renamed directory or file may not match how the agent identifies the item.

If the links break later, the clone probably moved. Recreate them from the new canonical path, repeating the conflict check.

To install more items afterward, run this template again. Already-linked items show as installed and stay untouched.
