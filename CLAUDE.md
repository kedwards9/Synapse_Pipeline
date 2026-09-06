# Synapse

Agent definitions, the specs behind them, and the small scripts that deploy,
check and instrument them. See `README.md` for what it is and where things
live.

## Deploying agents

    node scripts/deploy-agents.mjs

Copies the agent definitions from `agents/` into `~/.claude/agents/`.
**Restart your session afterward** — definitions load at session start.

## Running the pipeline

    claude --agent synapse-manager

Manager orchestrates planner, coder, and reviewer for a code task.

## Key rules

**Nothing half-built ships in an agent definition.** Every emitted field and
every granted tool needs a path by which it gets used. Wire it or delete it.

**The pipeline does not fix the pipeline.** Changes to `agents/*.md` are made
outside the pipeline, by a plain session. A Manager run editing its own
definition is executing the old text for the entire run.

**After editing an agent:** run `node scripts/deploy-agents.mjs` and restart
your session.

**Cite code by symbol, never by line number.** In plans and dispatch prompts,
name the symbol or quote the code — a stale line number resolves to different
code silently.
