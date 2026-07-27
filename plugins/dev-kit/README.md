# dev-kit

Four development agents, each pinned to an explicit model, routed by task type.
Agents and commands only — no hooks, no MCP server, nothing that blocks or
intercepts your work.

## Why

An audit of ~1,500 Claude Code requests across a real project found **90% of
spend went to a Mythos-tier model doing implementation or grunt work**, and
**80% of the bill was context rent** — cache reads and writes, not output
tokens. Cost per request barely varied by task: a `docker ps` cost the same as
an architecture decision, because both re-read a 400k-token context.

Two levers follow. Route work to a model that matches the task, and give
delegated work its own small context. This plugin is the routing half; the
context half is what subagents do by construction — each starts clean.

## Agents

| Agent       | Model                       | Effort   | Tools                                          | For                                                 |
|-------------|-----------------------------|----------|------------------------------------------------|-----------------------------------------------------|
| `architect` | `claude-fable-5`            | `max`    | Read, Grep, Glob                               | Design decisions. Read-only — proposes, never edits |
| `builder`   | `claude-opus-5`             | `high`   | Read, Edit, Write, MultiEdit, Grep, Glob, Bash | Code against a settled design                       |
| `operator`  | `claude-sonnet-5`           | `medium` | Bash, Read, Grep, Glob                         | Tests, builds, docker, ssh, logs, deploy checks     |
| `scout`     | `claude-haiku-4-5-20251001` | `medium` | Read, Grep, Glob, Bash                         | Discovery, tracing, "where is X"                    |

The architect is read-only via its **tool grant**, not `permissionMode` — plugin
agents silently ignore `permissionMode`, so the tool list is the only real
permission boundary. It returns an ADR body for the caller to write to disk.

### Why explicit model IDs rather than aliases

`model: opus` would keep working across model retirements; `claude-opus-5` will
break loudly when that ID is withdrawn. That is the intended trade. An alias can
silently re-point to a different model at a different price, which is precisely
the failure this plugin exists to prevent — and silent cost drift is worse than
a loud failure that gets a deliberate, reviewed bump.

This also matches the rest of this marketplace: exact pins, moved deliberately,
recorded in the commit.

One deliberate exception: `/dev-kit:delegate` may pass `model: "sonnet"` on a
builder Agent call for mechanical work. The Agent tool's per-call override
accepts only tier aliases — an exact ID is not an option there — and the
override narrows a single call without re-pointing any agent; every frontmatter
pin stays an exact ID. That is the only alias in the plugin, and delegate.md
bounds it to exactly that case.

To change a tier, edit the `model:` line in the agent and bump `version` in
`.claude-plugin/plugin.json` in the same commit.

### Why `effort` is pinned too

**Omitting `effort` makes a subagent inherit the session's level.** Verified in
real transcripts: across 1,926 recorded requests, the built-in `Explore`, `Plan`
and `general-purpose` agents all ran at `xhigh` because the main session was set
to `xhigh`. Discovery work was doing maximum-depth reasoning to run a `grep`.

The model pin does not fix this. `model:` controls the per-token rate; `effort`
controls how many thinking tokens get generated — Anthropic documents roughly a
7× token spread between levels, billed as output. Pin both or the cheap agents
still think expensively.

**Precedence, highest first:** `CLAUDE_CODE_EFFORT_LEVEL` env var → agent
frontmatter → session level (`/effort`, `--effort`, `effortLevel` in
settings.json) → model default. If that env var is set on your machine it
overrides every pin in this plugin — check before concluding these settings do
nothing.

Effort support on Haiku 4.5 is **undocumented**, so `effort: medium` on the
scout may be a no-op. Harmless, and correct if support lands later — but see the
fallback below before relying on it.

The levels are deliberately asymmetric. Effort is roughly 11% of total spend
(~68% of output tokens are thinking, and output is ~16% of the bill), so the
direct cost of raising it is small either way. What differs is turn count:
thinking blocks are passed back on later turns, so extra thinking compounds into
context for any agent that runs long.

The architect answers one question and stops — no compounding tail, and depth is
the whole reason it sits on a Mythos-tier model, so it gets `max`. The builder
ran 224 requests in a week in the audited project; making it think harder
inflates its own context across a long run. It stays at `high`.

There is also a design reason: if the builder needs more reasoning to implement
a settled design, the design was not settled. That should surface as an
escalation to the architect, not get absorbed by a higher effort level.

The scout sits at `medium` rather than `low` because its failure mode is the
quiet one. A wrong "not found" does not fail loudly — it feeds a bad premise to
an architect running at `max`, and one avoided round-trip there outweighs years
of the difference in scout tokens.

The operator sits at `medium`. Its job is mostly mechanical — run, filter,
report, hand back — which argues for `low`; but it also has to interpret
failures and decide which lines of output matter, and a wrong reading of a test
run or deploy check feeds bad state back to the caller. `medium` buys that
interpretation without inviting it to theorise far past its brief — a real risk
for the one agent with unrestricted `Bash`, including against remote hosts.

### If the scout proves unreliable

Raising its effort may do nothing, since Haiku's effort support is undocumented.
The real lever is the model. Change `scout.md` to:

```yaml
model: claude-sonnet-5
effort: low
```

Sonnet at `low` is a materially different agent from Haiku at `medium`, and
costs about $1.60/week more at the volumes this was calibrated against. Prefer
that over climbing the effort ladder on Haiku. Bump `version` in the same commit.

## Commands

| Command                           | Does                                                            |
|-----------------------------------|-----------------------------------------------------------------|
| `/dev-kit:delegate <task>`        | Triages the task: trivial edits to known files stay inline, everything else is split and routed |
| `/dev-kit:adr [label] <question>` | Scout locates the code, architect decides, the ADR gets written |

Commands are always namespaced — `/dev-kit:delegate`, not `/delegate`.

## Do agents get picked automatically?

Usually, but not reliably. Claude Code reads each agent's `description` and
delegates on its own; these descriptions are written to trigger that. But it is
a heuristic — the main thread will often just do the work itself, and the
tendency worsens as context grows and the descriptions drift further from the
current turn. `/dev-kit:delegate` is the deterministic path when it matters.

## Install

```bash
# whole machine
claude plugin install dev-kit@vimukthi-plugins

# or one project — run from that project's directory
claude plugin install dev-kit@vimukthi-plugins --scope project
```

No configuration. Nothing machine-local. Nothing to set up before first use.

## Usage

### Naming an agent directly

Plugin agents have no slash command of their own. Ask for one by name and the
main thread delegates to it:

```
Use dev-kit:scout to find where entitlement metadata gets validated.

Send dev-kit:operator to run the themis-api suite and report what fails.

Have dev-kit:builder add the limit_value >= 0 check to EntitlementDtos.kt,
per ADR-001. Do not change the migration.
```

Auto-selection also happens — the main thread reads each agent's description and
often delegates unprompted — but it is a heuristic and it decays as context
fills. Name the agent when it matters.

### `/dev-kit:delegate`

Give it the whole task. A trivial, fully-specified edit to an already-known
file is handled inline — delegation overhead is never recovered on a two-line
change. Anything needing discovery, real implementation, or execution is split
and routed:

```
/dev-kit:delegate the lifecycle job is skipping licenses whose customer was
soft-deleted; find why and fix it

/dev-kit:delegate add a featureMeta block to the entitlement document and cover
it with a size-budget test

/dev-kit:delegate verify the argus deploy actually picked up client-v0.2.0
```

The first routes scout → builder → operator. The second may pull in the
architect if the document shape is a contract question. The third is operator
alone.

### `/dev-kit:adr`

```
/dev-kit:adr schema should entitlement limits live on the plan feature row or
in a separate limits table

/dev-kit:adr concurrency how should the nightly lifecycle job behave when two
schedulers overlap
```

Scout locates the relevant code first, the architect decides, the ADR is written
to `docs/adr` with its `Guards:` and `Touches:` lines. If you leave the question
vague it will ask you one question rather than guess.

### Briefing well

The saving comes from subagents starting with a small context. A bad brief
throws that away.

```
Bad:   Here is the contents of EntitlementService.kt [3000 lines pasted]
       — now have the builder add validation.

Good:  dev-kit:builder — add a non-negative check on limitValue in
       themis-api/src/main/kotlin/.../entitlement/EntitlementDtos.kt.
       Pattern to follow: the tierRank validation in the same file.
       Add a case to EntitlementDtosTest.
```

Name the files; let the agent read them — do not paste file bodies. But put
what you already know into the brief: the constraints, the tooling the repo
already has, the approaches already ruled out. A subagent starts from a clean
context, so whatever the brief withholds it must rediscover at full price — and
may rediscover badly. Re-sent main-thread context bills at roughly a tenth of
input price under prompt caching; a subagent's cold start does not.

### Sequencing

Most real tasks are three of these in order:

1. **scout** — where is it, what already exists
2. **architect** — only if a decision is genuinely open, and only after the scout
   has found the code
3. **builder** — write it
4. **operator** — run the tests, verify the deploy

Skip step 2 whenever an ADR already covers the question. It is the expensive one.

### What not to send where

| Don't | Do |
|---|---|
| architect: "where is the lifecycle scheduler?" | scout |
| architect: "write the migration we agreed" | builder |
| builder: "should this be a new table or a column?" | architect |
| builder: "ssh to the testbed and restart argus" | operator |
| operator: "fix the failing test" | operator reports, builder fixes |
| scout: "is this code any good?" | scout reports, that is a review task |

## Limits

- **No automatic model routing exists in Claude Code.** No hook can change model
  selection. Routing happens only through these agents, so work that stays on
  the main thread stays on the main thread's model.
- **Sub-delegation does not cascade.** None of these agents can spawn agents;
  routing is a decision the main thread makes once.
- **Nothing here enforces delegation.** There are no hooks. If the main thread
  decides to grep rather than send the scout, it will.
- Agent changes need `/reload-plugins` or a restart to take effect.
