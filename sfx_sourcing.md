# Sourcing and preparing sound effects

How to fill the folders that the stream deck's SFX buttons play from (`sfxFolders` in
`config.json` on web; the SFX folder picker in Settings on Android). See `plan.md` for how
the app reads them.

## Curate — don't bulk-import

Every SFX button is bound by hand to **one specific clip**, and the library carries no tags
or metadata beyond folder and filename. So a 30,000-file dump makes the clip picker
unusable and leaves almost every file as dead weight in the scan.

Aim for **40–80 clips you actually chose**. Bulk libraries are the raw material, not the
goal. Your folder names become your only categorisation, so name them the way you think at
the table.

## Two different problems

**One-shots** — thunderclap, sword clash, door slam, dragon roar. Easy: any library works.

**Ambience loops** — rain, tavern crowd, forest, wind. Harder, and worth knowing before you
start collecting: an ambience button sets `audio.loop = true`, so the file must be
**seamlessly loopable** or you will hear a click every time it wraps. Most field recordings
are not. Either source purpose-made loops, or crossfade the ends yourself (Audacity: select
all → Effect → Crossfade Ends).

## Where to get them

| Source | Licence | Best for |
| --- | --- | --- |
| [Sonniss GDC Game Audio Bundle](https://gdc.sonniss.com/) | Royalty-free, personal **and** commercial, no attribution | One-shots, in bulk |
| [Freesound](https://freesound.org) | **Per file**: CC0 / CC-BY / CC-BY-NC | Targeted grabs |
| [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/) | RemArc: research / educational / **personal** only, non-commercial | Breadth, good metadata |
| [Tabletop Audio](https://tabletopaudio.com/) | Check their terms; streaming free | RPG ambiences that loop properly |
| [Pixabay](https://pixabay.com/sound-effects/search/rpg/) | No attribution required | Quick fills |

Notes on the two most useful:

- **Sonniss** release a bundle free every year for GDC and keep past years downloadable — it
  is a lot of high-quality material for nothing. The catch is that it is organised by sound
  designer, not by theme: you are mining `metal_impact_large.wav`, not browsing a "tavern"
  folder. Good for one-shots, poor for ambience.
- **Freesound** licensing is per file, not per site. Filter to **CC0** and you avoid
  attribution bookkeeping entirely. It also has a REST API if you ever want to script
  collection.
- **BBC** is the best-catalogued of the free sets, and a personal GM tool sits squarely
  inside the RemArc licence — just don't build anything commercial on it.

## Prepare the files *before* you build the deck

This ordering is not cosmetic. Clips are identified by
`trackSignature(basename, roundedDuration)` — the filename stem plus duration rounded to the
whole second — **not** by path. So **renaming a clip, or trimming or normalising it, changes
its identity and breaks every deck button bound to it.** The button degrades to a dimmed ⚠
rather than crashing, but the binding is gone and you have to rebind it.

So, in this order:

1. **Rename** to what you want to see in the picker — `thunder-close.wav`, not
   `SNMTL_Impact_Metal_Lrg_03.wav`.
2. **Trim** silence off the head and tail. Dead air at the start makes a one-shot feel
   laggy when you press the button.
3. **Normalise levels across the whole set.** A library thunderclap and a Freesound owl hoot
   will be wildly different volumes. Doing this once is far better than fighting it later
   with per-button volume sliders.
4. **Check every loop** actually loops without a click.
5. *Then* build the deck buttons.

## Suggested layout

Folder names are the categories, so keep them shallow and obvious:

```
sfx/
  weather/      thunder, rain-start, wind-gust
  combat/       sword-clash, arrow-hit, shield-block
  creatures/    dragon-roar, wolf-howl, owlbear-screech
  doors/        door-creak, portcullis, chest-open
  magic/        fireball, teleport, healing-chime
  ambience/     tavern-crowd, forest-night, cave-drips, rain-loop
```

Keeping loops in their own folder is worth doing — they are the ones with the seamlessness
requirement, and it makes them easy to find when binding ambience buttons.

## Keep the audio out of git

Licences vary per file and this repository is public. Point `sfxFolders` at a directory
**outside the repo**, or gitignore it. The same applies to your music library.
