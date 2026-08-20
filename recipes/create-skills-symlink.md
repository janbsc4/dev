# Recipe: shared skills symlink

Use this recipe to make the skills in a persistent clone of this repository available to a coding agent through symbolic links. Run it once for each agent installation that should use the shared skills.

Do not infer the destination from the model name. Discover how the installed agent loads user-level skills, then choose a link layout that matches that contract.

## Result

The finished setup must:

- use this repository's `skills/` directory as the source
- target a documented user-level skills location
- confirm that the target understands directories containing `SKILL.md`
- show the exact source, destination, and rollback command before changing files
- obtain explicit user approval before creating links
- preserve every existing file, directory, and unrelated symlink
- use absolute paths so links do not depend on the current working directory
- verify that every created link resolves to the intended source
- make rollback remove only the links, never their targets

## 1. Resolve the source

Find the repository root from the recipe's location or with Git. Resolve it to an absolute canonical path, then set the source to its `skills/` directory.

Verify that:

1. The repository is a persistent clone, not a temporary checkout.
2. The source directory exists.
3. At least one direct child directory contains `SKILL.md`.
4. The source is readable by the current user.

Do not copy the skills. The links should continue to expose updates made in this clone.

This step is complete when the canonical source path is known and every skill intended for linking has a readable `SKILL.md`.

## 2. Discover the destination contract

Inspect the installed agent's documentation, local help, and existing user configuration. Determine:

1. The user-level directory where it discovers skills.
2. Whether that directory may itself be a symbolic link.
3. Whether it scans child directories for `SKILL.md`.
4. Whether it requires one link per skill or accepts a linked skills root.
5. Whether configuration must be reloaded after filesystem changes.

A directory called `rules`, `prompts`, or `skills` is only a candidate. Confirm that it understands the source layout before using it. A generic rules directory may not load `SKILL.md` files.

If no supported destination is found, stop and ask the user for the agent's documented location. If multiple destinations are valid, list them and ask the user to choose. Do not guess.

This step is complete when one documented destination and one supported link layout have been selected.

## 3. Inspect conflicts and request approval

Inspect each proposed destination without following symbolic links.

Classify it as one of these cases:

- **Absent.** The link may be created.
- **Link to the intended source.** Treat setup as already complete for that path.
- **Link to another source.** Stop. Show both targets and ask how the user wants to resolve it.
- **Broken link.** Stop. Do not replace it without separate approval.
- **Regular file or directory.** Stop. Do not delete, rename, merge, or overwrite it without a separate migration plan and approval.

Choose one of these layouts according to the destination contract:

### Linked skills root

Use this only when the agent allows its entire user skills path to be a link and that path is absent:

```text
<user-skills-path> -> <repository>/skills
```

### Individual skill links

Use this when the agent owns an existing skills directory and scans its direct child directories:

```text
<user-skills-path>/<skill-name> -> <repository>/skills/<skill-name>
```

Check every child destination before proposing the change. Skip links that already point to the correct source. Any collision blocks that link until the user chooses a resolution.

Before mutation, show:

- the selected agent and its documented discovery behavior
- every absolute source and destination pair
- every existing path classification
- whether a reload or restart will be needed
- the exact rollback command for each new link

Ask for explicit approval. A general request to use this recipe is not approval to overwrite or remove an occupied destination.

This step is complete when all destinations are absent or already correct and the user has approved the exact links to create.

## 4. Create the links

Create only the approved, absent links. Quote every path and do not use force flags.

For a linked skills root:

```bash
ln -s "/absolute/path/to/repository/skills" "/absolute/path/to/user-skills-path"
```

For an individual skill:

```bash
ln -s "/absolute/path/to/repository/skills/example-skill" "/absolute/path/to/user-skills-path/example-skill"
```

If a command fails, stop. Reinspect the destination before deciding whether to retry. Do not remove a path merely because link creation failed.

This step is complete when every approved link command has succeeded and no unapproved path has changed.

## 5. Verify discovery and rollback

For every created or pre-existing correct link:

1. Confirm that the destination is a symbolic link.
2. Resolve it and compare its canonical target with the intended source.
3. Confirm that `SKILL.md` is readable through the destination.
4. Reload the agent if required.
5. Ask the agent to list or invoke one linked skill through its normal skill mechanism.

Rollback removes only the symbolic link. First verify that the rollback path is still a link, then use:

```bash
rm -- "/absolute/path/to/the-symlink"
```

Never add a trailing slash to the rollback path. Never use recursive deletion. Removing the link must leave the repository and every source skill untouched.

The recipe is complete when the agent discovers the linked skills, each link resolves to the intended source, and the rollback commands are recorded for the user.

## Troubleshooting

If the agent cannot see the skills, confirm that the selected destination supports `SKILL.md` rather than another rules format. Then check link resolution, directory permissions, and the agent's reload requirements.

If a destination already exists, do not work around it with a force flag. Decide whether the existing content should remain, move through a separately approved migration, or use individual skill links in a supported parent directory.

If links break after the repository moves, recreate them from the new canonical source path after repeating the conflict check and approval step.
