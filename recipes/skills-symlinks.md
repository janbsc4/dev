# Recipe: shared skills symlink

Use this recipe to install skills from a persistent clone of this repository into a coding agent's user-level skills directory. Each selected skill gets its own symbolic link, so editing the clone updates the installed skill.

Run it once per agent installation. Run it again later to add skills you skipped the first time.

## Result

The finished setup must:

- detect the user-level skills directories of installed agents
- ask which agent to install into when it finds more than one
- present every available skill with its name and description
- let the user choose any subset, including all skills
- create one symbolic link per selected skill, pointing into this repository's `skills/` directory
- leave unselected skills uninstalled
- preserve every existing file, directory, and unrelated link
- use absolute paths so links do not depend on the working directory
- verify that each new link resolves to the intended skill
- report the exact rollback command for each link you create

## 1. Resolve the source skills

Find the repository root with Git or from this recipe's location, then resolve it to an absolute canonical path. The source directory is `<repository>/skills`.

Collect every direct child directory that contains a readable `SKILL.md`. Ignore other files and directories, including `.DS_Store` and supporting documents inside a skill folder.

Confirm that the clone is in a permanent location. The links break if the repository later moves or disappears, so a temporary checkout is not a valid source.

This step is complete when you know the absolute source path and have found at least one skill directory with a readable `SKILL.md`.

## 2. Find candidate agent directories

Check for these user-level locations, which are the common ones:

```text
~/.kiro/skills/
~/.claude/skills/
~/.cursor/rules/
~/.windsurf/rules/
~/.codex/skills/
~/.agents/skills/
```

Treat a path as a candidate when it exists, or when its parent agent directory exists and the agent documents that skills path. A missing parent usually means the agent is not installed, so do not create directories for agents the user does not have.

Then resolve the ambiguity:

- **One candidate.** Name it and continue.
- **Several candidates.** List them and ask the user which agent to install into. Do not pick for them, and do not install into all of them unless the user says so.
- **No candidates.** Ask the user for the agent's documented user-level skills path.

A directory named `rules` or `prompts` is only a candidate. Before using it, confirm the agent loads skills as child directories containing `SKILL.md`. A rules directory that expects single Markdown files will not load this layout, and linking into it produces no working skills.

This step is complete when you have one destination directory and have confirmed it loads `SKILL.md` directories.

## 3. Present the skills and ask which to install

Read the YAML frontmatter of each `SKILL.md` and extract `name` and `description`. Fall back to the directory name when `name` is missing, and to the first meaningful line of the body when `description` is missing.

Show a numbered table so the user can choose by number or name:

```text
Available skills in /absolute/path/to/repository/skills

  #  Skill               Description
  1  grill               Grill the user relentlessly about a plan, decision, or idea.
  2  unslop              Cut AI tells from any writing. Must always apply.
  3  writing-for-agents  Write and edit documents for agents.

Already installed: (none)

Which skills should I install into ~/.kiro/skills?
Reply with numbers (for example: 1 3), skill names, or "all".
```

Shorten a long description to one line in the table. Mark any skill that already links correctly as installed and leave it out of the default selection. Also mark skills you cannot link because something already occupies the destination, and say what occupies it.

Accept numbers, names, and `all`. Confirm the parsed selection back to the user before touching the filesystem, and stop if any entry is ambiguous or unrecognized rather than guessing which skill was meant.

This step is complete when the user has an explicit list of skills to install and has confirmed the list you echoed back.

## 4. Inspect each destination for conflicts

For every selected skill, the destination is:

```text
<destination-directory>/<skill-name>
```

Inspect each destination without following symbolic links, and classify it:

- **Absent.** Ready to link.
- **Link to the intended skill.** Already installed; skip it and report it as already done.
- **Link to another location.** Skip it and ask the user before changing it.
- **Broken link.** Skip it and ask before replacing it.
- **Regular file or directory.** Skip it. Do not delete, move, merge, or overwrite real content.

Create the destination directory only when the agent documents that path and the user approves.

Show the user, before any change:

- the chosen agent and destination directory
- each source and destination pair as absolute paths
- every skipped destination and its reason
- whether the agent needs a restart or reload afterward
- the rollback command for each link you will create

Then ask for approval. Asking for this recipe is not approval to overwrite an occupied path.

This step is complete when every selected skill is either ready to link or explicitly skipped, and the user has approved the exact list.

## 5. Create the links

Create one link per approved skill. Quote both paths and do not use force flags:

```bash
ln -s "/absolute/path/to/repository/skills/grill" "$HOME/.kiro/skills/grill"
```

If a command fails, stop and reinspect that destination before retrying. Never delete a path just because linking failed.

This step is complete when every approved link exists and no skipped or unapproved path changed.

## 6. Verify and record rollback

For each installed skill:

1. Confirm the destination is a symbolic link.
2. Resolve it and compare the canonical target with the intended skill directory.
3. Confirm `SKILL.md` is readable through the link.

Then restart or reload the agent if required, and have it list or invoke one installed skill through its normal skill mechanism. A link that resolves correctly but never loads usually means the destination format was wrong, so return to step 2.

Rollback removes only the link:

```bash
rm -- "$HOME/.kiro/skills/grill"
```

Verify the path is still a link before removing it. Never use a trailing slash and never use recursive deletion. Removing a link must leave the repository untouched.

Report the installed skills, their destinations, the skipped ones with reasons, and the rollback commands.

The recipe is complete when the agent loads every selected skill, each link resolves to this repository, and the user has the rollback commands.

## Troubleshooting

If the agent shows no skills, confirm the destination loads `SKILL.md` directories rather than flat rule files, then check link resolution, permissions, and whether the agent needs a reload.

If a skill name collides with one the user already wrote, keep theirs. Ask whether to rename the incoming link, and remember that a renamed directory may not match how the agent identifies the skill.

If the links break later, the clone probably moved. Recreate them from the new canonical path, repeating the conflict check.

To install more skills afterward, run the recipe again. Already-linked skills show as installed and stay untouched.
