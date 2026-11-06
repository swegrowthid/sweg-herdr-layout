# Contributing

This repo collects custom window layouts for [Herdr](https://herdr.dev). A
layout is a self-contained folder that mirrors the layout part of a Herdr home,
so a person can copy it into `~/.config/herdr-app` and switch to it.

## Repo map

```
layouts/
  <name>/                 one layout per folder
    layouts/<name>.json   the layout tree
    mods/<mod>/           mods the layout adds (main.js, mod.json, assets)
    keys.json             keys snippet to merge
    RECIPE.md             the brief another agent can rebuild it from
    preview.png           screenshot
  sweg/                   main layout, the only published one
templates/
  layout/                 starting point for a new layout, not published
scripts/
  new-layout.py           generator: template -> layouts/<slug>/
docs/                     research notes, not part of a layout
README.md                 layout gallery and install steps
```

A layout folder is the unit that gets copied or shared. It must not depend on
files outside its own folder except the shipped Herdr mods and the files its
`RECIPE.md` names.

## Naming conventions

- Layout slug: kebab-case, matches the folder and the layout file. Rules:
  `^[a-z][a-z0-9-]{1,31}$`. Example: `sweg` lives in `layouts/sweg/` with the
  layout at `layouts/sweg/layouts/sweg.json`.
- Main layout is `sweg`. Only `sweg` is published. A retired layout leaves
  `layouts/` entirely; git history keeps it.
- A layout's own mods are named `<layout>-<role>`, for example `<layout>-panel`,
  `<layout>-tabs`, `<layout>-menu`, `<layout>-settings`. Roles are short nouns.
  For `sweg` this gives `sweg-panel`, `sweg-tabs`, `sweg-menu`, `sweg-settings`.
- The mod folder name is the mod name and the `content.mod` value. One mod per
  folder, one idea per mod. A role that needs two drawing modes is still one
  mod with `props` (see `sweg-panel`).
- Shipped Herdr mods keep their shipped names (`files`, `changes`, `tabs`,
  `pane`, `spaces`, `agents`, `workspace-chrome`, ...). Only customized copies
  live here, and the copy gets the layout prefix.
- File names are kebab-case: `px0-workspace.py`, `preview.png`, `RECIPE.md`.
- Do not rename or move another layout in a PR that adds your own.

## Create a layout

From the repo root:

```
python3 scripts/new-layout.py my-layout
```

The generator validates the slug, copies `templates/layout/` to
`layouts/<slug>/`, puts `layout.json` at
`layouts/<slug>/layouts/<slug>.json`, replaces the template placeholder in
file contents and in file and folder names, and prints the next steps. It
refuses an invalid slug and a folder that already exists.

The template has:

- `layout.json`: a root row with one example mod block and one active-tab
  terminal block, `titlebar: none` and `background: canvas`. The generator
  puts it at `layouts/<slug>/layouts/<slug>.json`.
- `mods/{{slug}}-example/`: `main.js` and `mod.json`, a small self-contained mod.
- `keys.json`: one key binding to a mod command.
- `README.md`: the per-folder instructions.
- `RECIPE.md`: the brief to fill in.

To copy by hand: `cp -R templates/layout layouts/<slug>`, make
`layouts/<slug>/layouts/`, move `layout.json` to
`layouts/<slug>/layouts/<slug>.json`, rename the mod folder, then replace the
placeholder in every file.

Then:

1. Edit the layout JSON. The format is in `~/.config/herdr-app/AGENTS.md`:
   node types `block`, `row`, `column`, `stack`; block content `mod`,
   `terminal`, `tab`, `agent`; sizes `px` or `weight`; root properties
   `titlebar`, `background`, `terminal_padding`, `divider`, `traffic_lights`,
   `preview`, `terminal_menu`.
2. Build the mods. Start from a shipped mod when you can:

   ```
   herdr-app do mod.clone --name tabs --as my-layout-tabs
   ```

   Then point the layout's `content.mod` at it, rewrite the mod's own
   `mods/<name>/` asset paths, and record `cloned_from` in `mod.json`.
3. Keep the layout ids stable. Commands (`layout.select`, `layout.toggle`,
   `layout.show`) and other mods find nodes by id.
4. Merge `keys.json` into the person's keys. It is a snippet, not a replacement
   file. Ask before replacing a key the person already uses, and avoid plain
   ctrl+letters because terminals need them.
5. Fill in `RECIPE.md`. The order is: what you see, how it behaves, built from,
   watch out, done when. Write it from the real files, exact over vague.
6. Add `preview.png`: run the layout and save a screenshot with
   `herdr-app shot layouts/<slug>/preview.png`.

## Install and check locally

Herdr reads a home dir (`~/.config/herdr-app` by default; `HERDR_APP_HOME`
selects another). A layout install is two copies plus a key merge:

```
cp layouts/<slug>/layouts/<slug>.json ~/.config/herdr-app/layouts/
cp -R layouts/<slug>/mods/* ~/.config/herdr-app/mods/
# merge layouts/<slug>/keys.json into ~/.config/herdr-app/keys.json by hand
herdr-app do layout.switch --name <slug>
```

Verification checklist:

- Every mod passes `herdr-app check <mod folder>`. A still-working screen is
  not proof an edit worked; read the check output.
- `herdr-app do layout.switch --name <slug>` shows the layout with no layout
  error file.
- `herdr-app status` reports no mod or layout errors.
- The keys and clicks in `RECIPE.md` do what it says.
- `preview.png` is a real screenshot of the layout, not a mockup.
- `git status` shows only files you meant to add.

`herdr-app check` writes `gpui-kit.d.ts` and `jsconfig.json` next to each mod
for editors. Both files are generated per mod and ignored by `.gitignore`.
Never commit them, and never stage `layouts/.state/`, `settings.json`,
`keys.json` or any other file from `~/.config/herdr-app`.

## Upgrade and drift

Mods in this repo are copies of shipped Herdr mods with small changes. When
Herdr updates, the copies do not update with it, so a layout can drift from the
app it targets:

- `mod.json` `cloned_from: {name, version}` records the source. Update it when
  you re-clone.
- On a new Herdr release, re-clone the shipped mod
  (`herdr-app do mod.clone --name tabs --as <layout>-tabs`), reapply the
  layout's changes, then run `herdr-app check`.
- Layout JSON fields can change between releases. Compare with the shipped
  layouts under `~/.config/herdr-app/layouts/` and the guide in its `AGENTS.md`.
- Note the tested Herdr version in `RECIPE.md` when it matters.

## What the gallery publishes

Herdr finds a shared layout through the repo topic `herdr-layout`, then lists
every `<folder>/layouts/<name>.json` file in the repo. Each match becomes one
card, named after the JSON file. Text in `README.md` or `docs/` does not add
a card; only that path does.

Keep the template and retired layouts out of that path:

- The template keeps its tree as `templates/layout/layout.json`. The generator
  puts it at `layouts/<slug>/layouts/<slug>.json` for a real layout.
- A retired layout leaves `layouts/` entirely.

Check before you push:

```sh
git ls-files | grep -E '(^|/)layouts/[^/]+\.json$'
```

The output must name only the layouts you mean to publish.

## Pull requests

1. Branch from `main` and add one layout or one focused change.
2. Run the verification checklist above.
3. Check the gallery path list above; only published layouts may match it.
4. Commit layout sources only: layout JSON, mod sources and assets, `keys.json`,
   `RECIPE.md`, `preview.png`. No generated files, no live config, no state.
5. Open a PR with what the layout looks like, what is new or changed, the
   Herdr version tested, and a screenshot. Keep it small; one layout per PR
   when you can.
