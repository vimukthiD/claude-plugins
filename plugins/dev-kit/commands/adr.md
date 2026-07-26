---
description: Draft an architecture decision record with the architect agent and save it
argument-hint: "[schema|contract|tenancy|concurrency|ops] <the question>"
allowed-tools: Read, Write, Grep, Glob, Agent
---

Draft an ADR for: **$ARGUMENTS**

Steps, in order:

1. Find the ADR directory. Look for `docs/adr`, `docs/decisions`, `adr/`, or an
   `adr` path already referenced in this repo's README or CLAUDE.md. If none
   exists, use `docs/adr` and say that you created it. Read the existing ADRs
   far enough to learn the local numbering and title style, and allocate the
   next number.

2. Locate the relevant code **before** involving the architect. Use
   `dev-kit:scout` for this. The architect is the most expensive agent in the
   kit — do not make it hunt for files.

3. Delegate the decision to `dev-kit:architect`. Give it:
   - the question,
   - the guard label if I supplied one,
   - the specific files and specs the scout found,
   - the ADR number you allocated.

   It is read-only and returns an ADR body. That is expected.

4. Write its output verbatim to `<adr-dir>/ADR-<NNN>-<slug>.md`. Do not
   paraphrase, summarise, or "improve" it.

5. Check the file has both a `Guards:` and a `Status:` line, and that `Touches:`
   names real paths. Fix the file if not.

6. Report the path and the one-line decision. Nothing else.

If I did not give you a clear question, ask me one question and stop. Do not
guess at what decision I want made.
