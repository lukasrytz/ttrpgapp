# Feature ideas

Brainstorm for where the app goes next. Written against how this table actually runs, not
against what is easiest to build.

## The brief this is written to

| | |
| --- | --- |
| **Setting** | In person, tablet in front of the DM |
| **Audience** | DM only — nothing here is player-facing |
| **Prep style** | Light skeleton, heavy improvisation |
| **Combat friction** | Forgetting monster abilities. *Only* that. |
| **Pacing friction** | All of it: scene changes, session shape, knowing the time, energy dips |
| **Systems** | 5e now, others likely later |

Two consequences worth stating up front, because they rule things out:

**Live play beats prep.** A feature that only pays off if you prepped it carefully is worth
much less here than one that pays off cold. That kills most "encounter builder" and
"campaign wiki" style ideas, however appealing they look.

**Combat is nearly fine.** Turn admin, expiry reminders and encounter setup were all
explicitly *not* problems. So the tracker needs one thing, not a rewrite.

## The tension to solve

You want **a session structure you can see**, but you prep a **light skeleton**. Those pull
against each other: any structure you have to build is prep you won't do.

The resolution is that the structure should already exist. `splitSections` in
`client/src/components/Markdown.tsx` already splits a note on `## ` headings, and the Play
view already renders them. So if your skeleton note is:

```markdown
## Tavern rumour
## The road ambush
## The ruin
## What's actually down there
```

…the app has your running order for free. Everything in "Session shape" below is built on
that: **your existing light prep becomes the structure, with no extra work.**

---

# 1. Combat: surface what the monster can do

The single combat ask. Today a monster carries `monsterRef { packId, entryId }` and you can
open the full stat block in a slide-over — which is "go and read it", exactly the thing that
doesn't happen mid-fight.

### The turn card

When the turn lands on a monster, show a compact card of *what it can do* — not the stat
block. Four to six chips: `Multiattack`, `Frightful Presence`, `Pack Tactics`, `Fire Breath
(recharge 5–6)`. Tap a chip for the full text in a bottom sheet. `BottomSheet.tsx` already
exists.

The point is that it is **pushed at you** on the right turn rather than fetched.

### Chips that nag until used

Forgetting isn't only "didn't know it existed" — it's "knew, and forgot to use it". So a
once-per-fight or recharge ability stays **lit until you tap it**, and dims once used.
Recharge abilities re-light on a roll at the start of the creature's turn. The tracker
already has `round` and `turnIndex` to hang that off.

This is the highest-value item in the document for the effort involved.

### What it needs in the data

SRD monsters currently carry only `fields: { hp, ac, dexMod, cr, size, monsterType }` —
abilities live as prose in the markdown `body`. Two options:

- **Parse the body at load.** No pack rebuild, but brittle against formatting.
- **Emit structured `actions` / `traits` in `plugins/dnd5e/scripts/convert.ts` and rebuild
  with `npm run build-srd`.** More upfront, far more robust. Recommended — the pipeline
  already exists and this is what it's for.

### Lair actions on initiative 20

Adjacent and cheap once the above exists: a lair-action reminder that fires at the top of
the round rather than on a creature's turn. Only worth it if you run lairs.

---

# 2. Pacing: the main event

All four pacing pains were live, so this is where the app has the most to gain.

## 2a. Scenes — one press changes the table

The deck's macros already fire music + ambience + navigation together. A **Scene** goes
further by being *stateful*: the app knows you are currently "in the tavern".

That difference matters because it makes **leaving** clean. A macro is fire-and-forget, so
moving from the tavern to the road leaves the tavern crowd still murmuring underneath. A
scene has enter and exit: entering "The Road" stops what "Tavern" started. The `sfxLoop`
action already has `start` / `stop` / `toggle` modes, which is exactly the primitive needed.

A scene is: a music filter, some ambience layers, optionally a note section to open, and a
name. Switching scenes is one press and the previous scene tears itself down.

**This also unlocks everything in 2b for free** — if the app knows which scene is active, it
knows when it started.

## 2b. Session clock and scene timing

There is no timer anywhere in the app today. Add the smallest useful one:

- **Session clock** — starts when you start the session, always visible on the deck.
- **Time in current scene** — falls out of 2a at no extra cost.
- **End-of-session summary** — where the time actually went, per scene. You'd learn more
  from three of these than from any amount of theorising about pacing.

Deliberately *not*: turn timers, countdown alarms, anything that beeps at you. You asked to
know where the session is, not to be prodded.

## 2c. The running order

Built on `splitSections`, per the tension above. Your session note's `## ` headings render
as a **tickable running order** on the deck:

- Each beat is one line, tappable, big enough for a thumb.
- Tap to mark it done, or to make it the active beat.
- The active beat shows how long you've been on it.
- What's left is visible at a glance, so you can see you have four beats and forty minutes
  and decide what to cut *while you can still act on it*.

Zero prep cost: it's the note you were already writing. If you didn't write one, the running
order is empty and nothing is lost.

Optional extension: tapping a beat also enters its scene, so the running order and the
scene switcher are the same control.

## 2d. Levers for when the energy drops

You improvise heavily, so these need to work cold, with no prep.

- **An oracle / complication deck.** One press gives a prompt tuned to the current scene:
  *someone arrives · a demand is made · it costs more than expected · it goes wrong now.*
  A small curated table, system-agnostic, kept short enough to stay good. Twenty entries you
  like beat two hundred you don't.
- **Escalate.** One press raises the temperature: music intensity +1 (the tag model already
  supports it) and a complication drawn from the above.
- **Cut to.** When a scene dies on its feet, jump to another beat in the running order
  without pretending the current one resolved.
- **NPC on demand.** The Generators page already does names and quirks/flaws. Wire it to a
  deck button so it's one press instead of a page visit — and let the result be **captured
  into the session note** with one more press.

---

# 3. Capture — the thing light prep needs most

If you improvise most of it, then by definition **most of what happens was never written
down**. The innkeeper you named, the promise you made, the faction you invented on the spot.
That's the material that bites three sessions later.

**One-press capture**: a button that opens a single-line input, appends a timestamped line to
tonight's session note, and gets out of the way. If a scene is active, the line is filed
under that beat, so the session note reconstructs itself as you play.

Combined with 2c this inverts the workflow in a way that suits you: you stop writing notes
*before* the session and start writing them *during* it, one line at a time, without breaking
flow.

Two real constraints, both known:

- There is no append API — `Backend` only has whole-file `writeNote(path, content)`, so it's
  read → concat → write.
- The notes editor holds an unsaved draft with a debounce, so an external append while that
  note is open in the editor **will clobber it**. The capture path has to either refuse while
  the note is open, or go through the editor's own buffer.

---

# 4. Smaller things worth having

- **Party passive perceptions on a card.** `PartyMember.passivePerception` is already stored
  and edited, and read by literally nothing. A one-press overlay is nearly free.
- **Keep the screen awake** (`@capacitor/keep-awake`). A tablet that sleeps mid-combat is a
  small, constant irritation.
- **Haptics on deck press** (`@capacitor/haptics`). Makes a touch deck feel like hardware,
  and you're not looking at it when you press it.
- **Roll on a table stored as a note.** Write your own tables as ordinary markdown lists in
  the vault; a button picks a random line. No new data model, and it suits improvisation.

---

# 5. Deliberately not proposed

Worth recording so these don't get re-suggested:

- **Player-facing display, handouts, second screen.** DM-only tool, by your answer.
- **Player accounts, shared characters, permissions.** A different and much larger app.
- **Prep-time tooling** — encounter builders, campaign wikis, relationship maps. Real
  features, wrong table: they charge you before the session and you don't prep that way.
- **Turn admin shortcuts, expiry reminders, faster encounter setup.** All the obvious combat
  features, none of them your problem. Building them would be building for a table that
  isn't yours.
- **Anything that beeps or nags on a timer.** Knowing the time is not the same as being
  interrupted by it.

---

# Suggested order

1. **Turn card with nag-until-used chips** (§1) — the one combat ask, and self-contained.
2. **Scenes with enter/exit** (§2a) — biggest pacing win, and 2b comes free with it.
3. **Running order from `## ` headings** (§2c) — highest value per line of code in the
   document, because the data already exists.
4. **One-press capture** (§3) — small, and it's what light prep is missing.
5. **Session clock and end-of-session summary** (§2b).
6. **Oracle, escalate, cut-to** (§2d) — best built after scenes exist, so prompts can be
   scene-aware.

## Keeping the plugin boundary honest

Since other systems are likely later: §2 and §3 are **core app** and system-agnostic. §1 is
**5e plugin** work. The mechanism for the plugin to contribute the turn card and its deck
buttons is the `ClientPlugin.actions[]` contribution point already recorded as the agreed
approach in `plan.md` — build that when §1 lands, rather than reaching into dnd5e from core.
