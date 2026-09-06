# Notices and acknowledgements

Synapse is MIT licensed — see `LICENSE`. This file records what it owes
to other people's work.

Two of these are legal notices. The rest is credit given because it is
deserved, not because a licence demands it.

---

## superpowers — Jesse Vincent (MIT)

<https://github.com/obra/superpowers>

**No superpowers code or text ships in Synapse.** A textual comparison of every
Synapse document against every superpowers document found exactly one shared
phrase of seven words or more, and it is the path `docs/superpowers/plans/` —
Synapse writing *into* superpowers' directory convention so the two interoperate,
which is a reference, not a copy.

**Its influence is nevertheless everywhere in this repo, and is the harder kind
to see.** Synapse was designed and built across many sessions running with
superpowers' skills active. The habits it enforces are visible in how this
project works rather than in what it says:

- **Brainstorming before building.** Nearly every design decision recorded in
  `specs/` began as a structured brainstorm rather than as a plan. The
  discipline of exploring intent before committing to an approach — and of
  treating "what are we actually trying to do" as a step with its own output —
  came from working under that skill.
- **Verification before completion.** The rule that a claim of success must
  carry pasted command output, which appears in `synapse-manager.md`'s
  stewardship stage and throughout `docs/VERIFYING.md`, is that skill's
  argument applied to an agent pipeline.
- **Surfacing assumptions, and discharging them with evidence.** The reason
  this repo's specs name what was *not* checked, and the reason ship blockers
  carry an "Unverified" section, is that habit.
- **Test-driven development and the shape of a good test.** The fixture design
  in `toy-repos/` — especially the insistence that a passing suite is not
  evidence of a sound codebase — is downstream of thinking hard about what
  tests actually establish.
- **`docs/superpowers/` as a plan and decision directory.** `synapse-planner`
  and `synapse-architect` write there by default. That convention is
  superpowers', adopted deliberately so a project using both is not fragmented
  across two layouts. (It is also ship blocker 7 — it hardcodes a convention a
  stranger may not use.)

### Andrej Karpathy, by way of superpowers

superpowers ships a `karpathy-guidelines` skill (MIT), which restates four
working rules Andrej Karpathy set out in [a public post about where LLMs go
wrong when writing code][k]. It loads into every session on the development
machine, so it shaped this work the same way the other skills did.

**No text from it is in Synapse.** Checked at five- and six-word runs against
the whole skill: zero matches. Its distinctive vocabulary — *surgical changes*,
*overcomplicated*, *adjacent code*, *push back* — appears nowhere here.

**A separate `karpathy-skills` package (forrestchang) is also installed on the
development machine and is not enabled.** Synapse contains none of it either —
zero matches at eight words across every file including `plans/` and
`HANDOFF.md`. Recorded because **it ships no licence at all**, which means
default copyright and no permission to reuse. Nothing here depends on that
being resolved, but anyone tempted to borrow from it should know.

Note also that superpowers' skill and that package share their four rule names
and their framing, and only superpowers declares a licence. **That chain is not
this project's to untangle** — it is noted so that a future session does not
treat `karpathy-guidelines` as a clean MIT source without looking upstream
first.

What overlaps is the thinking, and Synapse arrived at it in its own words:
*simplicity first* became "no speculative build-ahead" and `CLAUDE.md`'s rule
that nothing half-built ships; *think before coding* became the habit of
recording what was **not** verified. Whether those would have been reached
without that skill in context is not separable after the fact, so the credit is
given rather than argued about.

[k]: https://x.com/karpathy/status/2015883857489522876

**Recommended.** If Synapse is useful to you, superpowers probably is too, and
it is free.

---

## ECC — Affaan Mustafa (MIT)

<https://ecc.tools>

ECC's rules layer was installed machine-wide during Synapse's development, and
loads into every session on the machine where this was written.

**One passage was originally copied and has since been rewritten.** ECC's
*Delegation Completion Contract* — the rule that an agent must collect what it
dispatches before ending its turn — appeared near-verbatim in
`synapse-architect.md` and `synapse-planner.md`. It was found on 2026-08-26 by
a mechanical comparison, and both instances were rewritten in Synapse's own
words. **The idea is ECC's and is credited here regardless**; the failure it
guards against is real and Synapse hit it independently, but ECC named the rule
first.

Short fragments remain in `agents/synapse-manager.md` and `docs/LESSONS.md` —
aphorisms of eight to ten words inside otherwise original prose, describing an
incident that happened here. They were left deliberately: rewriting an accurate
account to avoid a short shared phrase would make it worse, and this notice is
the honest remedy.

**How it got there is worth recording.** ECC's rules load into every session as
standing instructions, which makes third-party text indistinguishable — from
inside a session — from the user's own. That is a general hazard for any
project developed under a machine-wide rules layer, not a criticism of ECC.

---

## Licence text

Both projects are MIT licensed. Their notices, reproduced as that licence
requires:

```
MIT License

Copyright (c) 2025 Jesse Vincent          (superpowers)
Copyright (c) 2026 Affaan Mustafa         (ECC)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## How this was checked

Not by memory. Every Synapse document was compared against every document in
each upstream by word-level shingling — any run of N or more consecutive words
appearing in both is flagged, with fenced code excluded so shared loop idioms
do not register as prose. Independent authorship of similar material produces
occasional short collisions on stock phrasing; copying produces long contiguous
ones. Against a background of zero, a 56-word run is not ambiguous.

What was compared, on 2026-08-26:

| Upstream | Licence | Result |
|---|---|---|
| ECC (Affaan Mustafa) | MIT | **94 words copied**, since rewritten. Short aphorisms remain, credited above |
| superpowers (Jesse Vincent) | MIT | Nothing. One path reference, `docs/superpowers/plans/` |
| superpowers `karpathy-guidelines` | MIT | Nothing at 5+ words |
| karpathy-skills (forrestchang) | **none** | Nothing at 8+ words, across every file including `plans/` and `HANDOFF.md` |

**Check what is installed, not what you remember installing.** ECC had been
half-uninstalled months before this audit and its rules layer was still loading
into every session; `karpathy-skills` is installed and not enabled. The
inventory that matters is `~/.claude/plugins/marketplaces/`, `~/.claude/rules/`
and `~/.claude/skills/` — not the plugin list.

Re-run all of it before any release. A dependency acquired by reading does not
announce itself, and the one found here got in without anyone deciding to copy
anything.
