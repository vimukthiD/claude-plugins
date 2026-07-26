---
description: Route work to the right dev-kit agent instead of doing it on the main thread
argument-hint: what you want done
allowed-tools: Agent, Read, Grep, Glob, Bash
---

Route this work: **$ARGUMENTS**

Classify it and delegate. Do not do the work on this thread.

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
- **Do not pre-read files on this thread** to "help" the subagent. That defeats
  the delegation — you pay for those tokens on every subsequent turn here.

When the subagents return, give me the consolidated outcome: what changed, what
was found, what still needs a decision. Keep it short.
