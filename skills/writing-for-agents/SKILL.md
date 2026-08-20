---
name: writing-for-agents
description: Write and edit documents for agents. Use when creating or editing skills, AGENTS.md, or CLAUDE.md.
---

Use this reference for any document an agent reads, including skills, `AGENTS.md`, `CLAUDE.md`, and documents reached through pointers. The format may change, but the same rules help an agent follow a consistent process across runs. They do not force identical output.

When writing a skill, also read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for frontmatter, invocation, and router skills.

## Context pointers

A **context pointer** names material outside the agent's current context and states when to load it. A skill description is a context pointer. So is a line in `AGENTS.md` that points to another document.

The pointer's wording determines whether the agent loads its target. A required document behind a vague pointer may never load. Tighten the pointer first. Inline the target only if clearer wording still fails.

A pointer must identify its target and name the **branches** that should load it. A branch is one distinct case the target handles. Always-loaded pointers consume tokens and attention on every turn, so prune them harder than the documents they point to:

- Start with the leading word that should trigger the pointer.
- Give each branch one trigger. Collapse synonyms that describe the same branch.
- Remove details that the target already supplies after loading.

## The two loads

Every document and pointer adds one or both of these costs:

- **Context load.** Material loaded on every turn consumes tokens and attention whether the agent needs it or not. Skill descriptions and lines in `AGENTS.md` are common examples.
- **Cognitive load.** The human must remember which documents exist and when to use them. Keep this cost where human judgment matters. Remove it where the agent can make the choice reliably.

A pointer moves most of a document out of context, but the pointer itself remains loaded. Material with no pointer avoids context load and leaves discovery to the human.

## Information hierarchy

Agent documents contain **steps**, which tell the agent what to do, and **reference**, which supplies definitions, rules, and facts. Place each piece according to when the agent needs it:

1. **In-file step.** The ordered work the agent performs.
2. **In-file reference.** Material the agent consults while doing that work. A flat set of peer rules is fine when every rule belongs at this level.
3. **Disclosed reference.** Material kept in another file and loaded through a context pointer. The target may be a sibling file or an external document.

Keep material close enough to be found, but do not let optional reference bury the steps.

**Progressive disclosure** moves material into a referenced file. Use it when only some branches need that material. Keep information needed by every branch in the main file. This protects the document's structure and keeps its steps visible.

**Co-location** keeps a concept's definition, rules, and caveats under one heading. Do not scatter one concept across the document. Duplication repeats a meaning. Scattering divides one meaning into disconnected pieces. Both make maintenance harder.

**Sprawl** means the document is too long even though each line is relevant and unique. Split it by branch or sequence so each run loads only what it needs.

## Steps and completion criteria

Every step needs a **completion criterion** that tells the agent when to stop.

- **Clarity.** The agent must be able to distinguish done from not done. A vague criterion such as "understanding reached" invites **premature completion**. Visible later steps can pull the agent forward before the current step is complete. First, make the criterion precise. If it must remain fuzzy and you observe the agent rushing, hide the later steps behind a real context boundary such as a handoff or subagent dispatch. An inline call leaves the later steps visible and does not solve the problem.
- **Demand.** The criterion must require enough evidence. "Every modified model is accounted for" demands more work than "produce a change list." This demand creates **legwork**, the investigation needed to satisfy the criterion. It also applies to reference. "Every rule applied" makes a flat set of rules exhaustive without turning each rule into a separate step.

A useful completion criterion is both checkable and exhaustive.

## When to split

Splitting a document raises context load or cognitive load. Split only when the benefit justifies that cost.

- **By sequence.** Hide later steps when seeing them causes the agent to rush the current step. Merging sequences can reintroduce that pressure.
- **By invocation.** Skills have a separate test for this. See [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Leading words

A **leading word** is a compact, familiar term that the model can use while following the document, such as _lesson_, _fog of war_, or _tracer bullet_. A familiar term carries associations from the model's training. An invented term needs a clear definition before it can do the same work.

Repeat the term where you need the behavior, not the full explanation. It can guide two decisions:

- **Execution.** In the document body, the term tells the agent what behavior to apply.
- **Invocation.** In a pointer, the same term helps the agent connect language in prompts, documentation, and code to the right material.

Look for repeated phrases that one precise term can replace. For example:

- Replace "fast, deterministic, low-overhead" with a _tight loop_.
- Replace "a loop you believe in" with _red_. A loop is red only when it reproduces the bug.

Keep a leading word only if it changes behavior. If a weak term such as _thorough_ changes nothing, choose a stronger term or remove it.

**Negation** tells the agent what to avoid and puts that behavior into context. State the positive target instead. For example, write "use one-line comments" rather than naming the comment style you do not want. Use a prohibition only for a hard guardrail that has no clear positive form. Even then, pair it with the desired behavior.

## Pruning

- **Single source of truth.** Keep each meaning in one authoritative place. **Duplication** wastes tokens, raises maintenance cost, and gives a repeated idea more weight than intended. Repeating a leading word is different because it repeats the label, not its definition.
- **Environment as source.** Scripts, configuration, directory structure, and `--help` output already describe the environment. Documentation that restates an easy lookup is a **cache** that can go stale. Keep the cache only when the lookup is expensive. Document conventions, reasons, and surprises that the environment cannot reveal.
- **Relevance.** Each line must affect the task. Remove exposition that changes no behavior, disclose branch-specific material, and delete stale claims. **Sediment** is stale material that remains because adding feels safer than deleting.
- **No-ops.** Test each sentence by removing it and checking whether agent behavior changes. This test depends on the model, not the human reader. Settle disagreements by running the document. Delete a sentence that changes nothing instead of trimming it. Apply the same test to leading words.
