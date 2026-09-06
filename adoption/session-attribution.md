# Adopting session attribution in a consumer repo

**What this solves.** You run two Claude Code sessions in one repository at the
same time — a plain or brainstorming session, and a `synapse-manager` pipeline session.
Neither knows the other exists, so each reports the other's commits as drift.

**You probably do not need this.** Manager anchors its drift check to the
commit HEAD pointed at when its session started, so a repository full of
untrailered history produces no alarm on the first task, and none on any task
where nothing else is committing. Adopt this only when you actually run a
second session alongside the pipeline and want its commits recognised instead
of flagged.

The design behind it is `specs/2026-08-25-session-attribution-design.md`. You
do not need to read that to use this file, and neither does the session you
hand the prompt to.

**How to use it.** Open a session rooted in the consumer repository — not in
Synapse — and paste everything below the line. Synapse publishes the pattern;
the consumer repo adopts it. That split is deliberate: Synapse does not write
another project's `CLAUDE.md`.

---

> We run two sessions in this repo at the same time: this brainstorming
> session, and a `synapse-manager` pipeline session. Neither has known the other
> exists, so each keeps reporting the other's commits as drift. The pipeline
> side of the fix has already shipped; this repo needs to adopt the other
> half.
>
> Add a short section to this repo's `CLAUDE.md` covering concurrent sessions.
> It needs to say four things:
>
> 1. **Sign every commit with a `Session:` trailer** naming the kind of
>    session that made it. A plain or brainstorming session uses
>    `Session: brainstorm` — including when it dispatches Synapse
>    specialists by hand rather than launching the pipeline. There are two
>    values only, and that is deliberate. It goes as the last line of the
>    message body, alongside any `Co-Authored-By:` line, and does not change
>    the conventional-commit subject.
>
>    If this session dispatches `synapse-coder`, tell it to sign
>    `Session: brainstorm` — your session's value, not the agent's. Coder
>    does not assume one and will stop and ask if you leave it out.
>
> 2. **Read the ledger instead of raising an alarm.** To see who did what:
>
>        git log <starting-commit>..HEAD --format='%h [%(trailers:key=Session,valueonly,separator=)] %s'
>
>    where `<starting-commit>` is what `git rev-parse HEAD` returned when this
>    session began. **Measure from where you started, not from a fixed number
>    of recent commits.** Everything older is this repo's history; it predates
>    the convention, it is untrailered for that reason alone, and it is not
>    drift.
>
>    Within that window, commits carrying another session's trailer —
>    `[manager]` — are **expected**. The user schedules both sessions and
>    already knows. Mention them in one line as context. Only **unattributed**
>    commits inside the window are drift worth flagging.
>
> 3. **This overrides the drift step in `/takehandoff`.** A moved `HEAD`
>    whose commits are attributed to `[manager]` is normal in this repo, not
>    something to flag before doing anything else.
>
> 4. **Never run `git add -A`, `git add .`, or `git commit -a`.** Stage only
>    the paths you actually touched. If you find changes you did not make,
>    leave them alone and say so — they are probably the manager session's
>    uncommitted work, and sweeping them into your commit mislabels them as
>    yours.
>
> The `synapse-manager` side is already done — Manager tells `synapse-coder` to
> sign `Session: manager` on every dispatch it makes, and manager's stewardship
> check already reads the trailer three ways — so do not add anything for that
> side.
>
> Keep the section short, and show me the diff before you write it.
