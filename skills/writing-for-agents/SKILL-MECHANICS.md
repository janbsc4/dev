# Skill mechanics

This file covers the parts of [`writing-for-agents`](SKILL.md) that apply only to skills: frontmatter, invocation, and router skills. Use `SKILL.md` for the writing rules shared by all agent-facing documents.

## Invocation

Choose between model-invoked and user-invoked skills. The choice trades context load against cognitive load.

### Model-invoked skills

A model-invoked skill keeps its `description` in the agent's context. The agent can load the skill on its own, and other skills can reach it. A human can still invoke it by name.

This discoverability adds permanent context load. Write the description as a model-facing context pointer that names each trigger branch. Follow the pointer rules in `SKILL.md`.

Several skills can use a model-invoked skill as shared reference. Other skills can invoke it instead of copying that material.

Omit `disable-model-invocation` from the frontmatter.

### User-invoked skills

Only a human can load a user-invoked skill by typing its name. Other skills cannot reach it. This removes the description from the agent's context, but the human must remember when to use it.

Set `disable-model-invocation: true` in the frontmatter. Write the `description` as a one-line summary for the human. It does not need model-facing trigger branches.

Choose model invocation only when the agent must discover the skill or another skill must reach it. If the skill always runs by hand, use user invocation.

If two user-invoked skills need the same reference, place it in a plain file outside the skill system. Both skills can point to that file without duplicating it.

## Splitting by invocation

Create a separate model-invoked skill only when one of these conditions holds:

- A distinct leading word used in real prompts should trigger it independently.
- Another skill must invoke it.

The new description adds permanent context load, so independent discovery must justify that cost. See `SKILL.md` for splitting by sequence.

## Router skills

When the human has too many user-invoked skills to remember, create one user-invoked **router skill**. The router lists the other skills and explains when to use each one.

A router can recommend a user-invoked skill but cannot load it. Only the human can do that because user-invoked skills have no model-visible description.
