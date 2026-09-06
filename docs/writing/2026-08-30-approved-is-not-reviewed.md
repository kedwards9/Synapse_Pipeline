# Approved is not reviewed

**A shareable write-up, 2026-08-30.** Written to be read by someone with no
context on this repository, which is why it explains the pipeline from scratch
and names nothing internal without defining it.

- **Published copy:** <artifact-url-removed>
- **The internal record, with the raw evidence:**
  `docs/experiments/2026-08-30-graded-run-three-cuts.md`
- **The design and plan under test:**
  `specs/2026-08-30-pipeline-burn-three-cuts.md`,
  `plans/2026-08-30-pipeline-burn-three-cuts.md`

> Keep this file and the published copy in step. If one is edited, edit both —
> a divergence here is the same class of defect as a stale map, and there is no
> script that catches it.

---

A multi-agent coding pipeline reviewed its own work, approved it, and shipped
two real defects. An independent review of the same commits found them in
minutes. **The interesting part is not that one review was better — it is that
the two barely overlapped at all.**

| | |
|---|---|
| Findings, total | **14** across two independent passes on the same three commits |
| Found by both | **2** — twelve of fourteen appeared in exactly one instrument |
| Approved defects | **2** medium-severity behavioural, one verified by execution |
| Predictions held | **6 of 6**, which is weaker evidence than it sounds |

---

## The setup, for anyone arriving cold

The system under test is a pipeline of specialised AI agents that build software
together. A **manager** routes a task; a **planner** turns it into numbered
steps; a **coder** implements; a **reviewer** — which never wrote the code —
judges it and returns a verdict. Each agent starts with no memory of the others.

That independence is the entire value proposition and also the entire cost.
Every agent re-orients in the codebase from scratch, so one task is paid for
four or five times over. On a large project that gets expensive fast, which is
what prompted the work being tested: three changes intended to cut the bill
without cutting the quality.

**Why this was measured rather than assumed.** The person running it suspected
the changes were trading accuracy for cost, and said so before the run. That
suspicion is the hypothesis on trial, and the experiment was designed to be able
to confirm it.

## Pre-registration

Six predictions were written down and committed to version control **while the
run was in flight**, before any result was known. The commit timestamp is
checkable against the run.

This matters because the alternative — writing the account afterwards — permits
the story to be shaped to fit whatever happened. Each prediction also named what
would falsify it.

| | Prediction | Outcome |
|---|---|---|
| P1 | The planner will be skipped entirely, because a design document already specified the task | Held |
| P2 | The coder will not reject that document as insufficient | Held |
| P3 | **A tripwire left in the code will fire, and the coder will resolve it correctly** rather than deleting the test that caught it | Held |
| P4 | A three-state design distinction will survive implementation instead of collapsing into two | Held |
| P5 | Task-close bookkeeping will take one agent dispatch, not three | Held |
| P6 | The run will cost more than doing the same work directly in one long-running session | Held |

**Six of six is weak evidence, and saying so is the point of pre-registering.**
Four of those predictions amount to *"a mechanism written this morning will do
what it was built to do."* That is barely a test.

**P3 is the exception.** A guard had been armed days earlier, with a note left
in the source for a reader who did not exist yet. The coder hit it, read the
note, and fixed the underlying list rather than weakening the assertion. Nothing
in the design guaranteed that, so it is the only prediction that measured
something.

## The result that mattered

The pipeline's own reviewer examined the work, produced roughly ten findings,
marked them all non-blocking, and returned `APPROVED`. A separate, independent
review was then run over the identical three commits, at comparable depth.

    Only the pipeline reviewer ........ 8
    Found by both ..................... 2
    Only the independent review ....... 4
                                       ──
    Total distinct findings ........... 14

| Pass | Character | What it found alone |
|---|---|---|
| Pipeline reviewer | Coherence between code and the documents around it | Design records citing retired mechanisms, docstrings claiming a feature does not exist yet, a stale backlog entry, an install check silently failing under a specific checkout mode |
| Independent review | Runtime correctness | Two medium-severity behavioural defects and two lower ones — all in code the first pass had read and approved |

**Neither pass was a superset of the other.** The obvious reading — that one
reviewer was simply worse — does not survive the data. They were looking at
different axes, and each was nearly blind on the other's.

## The two defects that were approved

Both are in a parser that reads a project's handoff log — a markdown file whose
newest entry lists open questions — and reports a summary on a dashboard card.

**1. Open questions bled across entries.** The parser bounded its
*bullet-counting* loop to the next heading, but not its *search* for the
heading. So it scanned past the newest entry into older ones. Verified by
running it: an entry with zero open questions, sitting above an older entry with
three, reports three. **The card attributes another entry's questions to the
newest one** — and looks entirely normal doing it.

**2. Only hyphen bullets counted.** The bullet pattern matched `- ` and nothing
else. A list written with `1.` or `*` reports **zero open questions**. That is
worse than an error: a plausible number the reader can glance at, believe and
act on, with no warning marker of any kind.

**Both are small fixes and neither is embarrassing on its own.** What makes them
worth reporting is that a dedicated review agent read this exact code, produced
ten other findings about it, and returned `APPROVED`.

## What this establishes

- **A verdict is not a measurement.** `APPROVED` means the agent found nothing
  blocking, which is a claim about that agent, not about the code.
- **Review instruments are narrower than they appear.** Twelve of fourteen
  findings were visible to exactly one pass. Treating a single review as
  coverage overestimates it by a wide margin.
- **The cost reductions worked mechanically.** Every intended change fired on
  its first live execution, and the suite grew from 790 to 813 passing with
  nothing broken.

## What it does not establish

- **That the cost reductions caused the defects.** Two of the three changes are
  irrelevant to every finding. Only one is even plausibly implicated, and that
  is speculation.
- **That the reviewer got worse.** There is no baseline for the same reviewer
  under the old configuration. The gap may be permanent and pre-existing.
- **Anything at all, robustly.** This is a single run of a single task.
  Six-for-six could be a working design or an easy task with an unusually
  thorough specification.

**n = 1.** That belongs on every number here. A second run on a different task
is what separates a working design from a lucky one, and it has not happened.

## The practical conclusion

The question going in was whether an independent reviewer *inside* the pipeline
earns the cost of running it. This run suggests the question was malformed.

A batched review **after** the pipeline finishes is not redundant with the
reviewer **inside** it. They are orthogonal instruments, and the evidence is the
overlap: two findings in common out of fourteen. Running one and calling it
covered is the actual mistake.

> The cost was cut, and then the quality bar turned out to need a second pass
> added back. Net cost is roughly a wash. Net knowledge is not — you now know
> what each instrument is blind to.

---

**The single most useful habit from this exercise was not technical.** Writing
the predictions down and committing them before the results existed is what
makes the weak ones identifiable as weak. Four of the six were self-fulfilling,
and that is only visible because they were recorded in advance rather than
narrated afterwards.

---

*Single run, one task, 2026-08-30. Suites 790 → 813 passing. Cost roughly 1% of
a weekly allotment and 5% of a five-hour window, for one task. Predictions
pre-registered in version control mid-run and left unedited.*
