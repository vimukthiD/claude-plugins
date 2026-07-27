---
description: Triage work - handle trivial known-file edits inline, route everything else to the right dev-kit agent
argument-hint: what you want done
allowed-tools: Agent, Read, Edit, Write, Grep, Glob, Bash
---

Route this work: **$ARGUMENTS**

Classify it, then either handle it inline or delegate — the gate below decides which.

## Triage first

Handle it inline on this thread, without delegating, when ALL of these hold:

- The files to change are already identified — by the user, or from context you
  already have.
- No discovery is needed. Nothing to search for, no "where is X".
- Nothing needs running beyond a single verification command.
- The whole job is roughly five tool calls or fewer.

Say in one line that you are handling it inline, and why. A bounded edit to a
known file costs less done here than briefed, delegated, reported and
consolidated — delegation adds a round trip on both sides plus a cold-start
context for the subagent, and none of that is recovered on a two-line change.

Delegate everything else.

| If the task is… | Send | Runs on |
|---|---|---|
| a design question — architecture, schema, contracts, tenancy, concurrency, consistency | `dev-kit:architect` | Fable 5 |
| writing or editing code against a settled design | `dev-kit:builder` | Opus 5 |
| finding things, tracing symbols, "where is / does this exist" | `dev-kit:scout` | Haiku 4.5 |
| running things — tests, builds, docker, ssh, logs, deploy checks | `dev-kit:operator` | Sonnet 5 |

Rules:

- **Split before you route.** Most real tasks are two or three of these in
  sequence: scout to find it, architect only if a decision is genuinely open,
  builder to write it, operator to verify it. Run independent parts
  concurrently, in one message.
- **Brief tightly.** Each subagent starts from a clean context — that is the
  entire point. Give it the specific paths and the specific question. Do not
  paste large excerpts; name the files and let it read them.
- **Default away from the architect.** It costs about ten times the others. Send
  it only when a decision is actually open, and only after the scout has located
  the relevant code. If an ADR already covers the question, skip it entirely.
- **Match the model to the difficulty, not the category.** The builder is pinned
  to Opus 5, which is right for real implementation. For mechanical work — copy
  edits, config, documentation, renames, or applying a diff you have already
  specified in full — pass `model: "sonnet"` on the Agent call. (The Agent tool
  only accepts tier aliases for per-call overrides, so this is the one place an
  alias is correct — do not "fix" it to an exact model ID.) Same agent, same
  instructions, at Sonnet's rate instead of Opus's — roughly 40% of the cost
  under Sonnet 5's introductory pricing, roughly 60% at list price.
- **Put what you already know into the brief.** Name the constraints, the
  tooling the repo already has, the paths you know, the approaches already ruled
  out. A subagent starts from a clean context: whatever you do not tell it, it
  must rediscover at full price — and may rediscover badly, then act on the
  worse answer. Still do not paste file bodies; name the file and let it read.
  But never withhold a fact to keep this thread thin. Main-thread context is
  prompt-cached at roughly a tenth of input price; a subagent's cold start is
  not.
- **When a brief offers fallback options, state the acceptance bar.** Say what
  "good enough" means, and say explicitly that reporting "no acceptable path
  exists" is a valid and preferred outcome. An agent given a ranked list of
  approaches and no quality floor will ship the worst one that technically
  executes.

When the subagents return, give me the consolidated outcome: what changed, what
was found, what still needs a decision. Keep it short.
