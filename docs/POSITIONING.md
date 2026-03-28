# Laizy positioning

## What Laizy is

Laizy is a repo-local control loop for milestone-based software delivery.

It does not try to be a new coding model, a hosted autonomous platform, or a general orchestration fabric. It sits around tools you already use — such as OpenClaw, Codex CLI, and Claude Code — and gives the work a durable execution shape:

- one explicit plan
- one active milestone at a time
- explicit worker handoff documents
- explicit verification before completion
- explicit recovery when progress stalls

In practice, Laizy acts as a narrow milestone supervisor and verification-gated delivery loop.

## Problem it is solving

Coding agents are good at generating work, but long-running delivery usually breaks down in predictable ways:

- the active slice gets widened mid-flight
- progress lives in chat history instead of durable files
- recovery after a stall is improvised
- "done" is declared before build/test/review evidence exists
- operators have to reconstruct state from memory

Laizy narrows that problem. It gives a repo a small set of machine-readable artifacts so planning, implementation, supervision, recovery, and verification can continue from files instead of vibes.

## What makes it different

### Repo-native, not hosted-first

Laizy keeps run state beside the work:

- implementation plan
- run snapshot
- append-only event log
- handoff contracts
- verification records

That keeps continuation local, inspectable, and easy to resume.

### Supervisor loop, not one big agent

Laizy does not collapse planning, implementation, verification, and recovery into one freeform prompt. The current code models those concerns as separate roles:

- planner
- implementer
- verifier
- recovery worker
- watchdog/supervisor cadence

The point is not ceremony for its own sake. The point is bounded handoff and easier restart.

### Verification-gated completion

A milestone should not move to `completed` because a worker says it is done. The current runtime already records verification results separately and gates completion on an explicit passed record. That is the core operating stance of the project.

## What Laizy is not

Laizy is not:

- a replacement for Codex, Claude Code, OpenClaw, or other coding agents
- a generic workflow engine for arbitrary business processes
- a hosted task board or PM suite
- a guarantee of autonomy with no operator judgment

The current repository is much narrower than that. It is a CLI that parses milestone plans, tracks durable run state, emits bounded next-step artifacts, and records verification/recovery evidence.

## Current product shape

As implemented today, Laizy provides a TypeScript CLI that can:

- bootstrap a run from a goal and plan
- persist a snapshot plus append-only event log
- track milestone lifecycle transitions
- emit planner and implementer contracts
- inspect health and propose recovery
- emit backend adapter documents for OpenClaw, Codex CLI, Claude Code, and a local Laizy watchdog path
- emit verification commands and record verification outcomes
- drive continuation through `start-run` and `supervisor-tick`

That makes the current product best described as a narrow repo control loop for supervised software delivery.

The source of truth is the repo-local state and the emitted contracts, not a chat transcript.

## Intended operator mental model

Use Laizy when you want this loop:

1. write or refresh an implementation plan
2. start a run once
3. let the supervisor select the next bounded action
4. execute one milestone
5. verify it explicitly
6. commit and push
7. recover safely if the loop stalls
8. repeat until closeout

That is a tighter and more accurate description than calling Laizy a broad orchestration platform.

## Scope discipline for Phase 1 docs

These docs intentionally describe the product in terms of what the current code already supports. They avoid roadmap hype and avoid implying features that only exist as aspirations.

If future versions grow beyond this control-loop identity, the docs can expand later. For now, the right framing is: Laizy is a milestone supervisor around existing coding agents, with durable state and verification gates.