# {{slug}}

A starting point for a Herdr layout. A layout folder holds the layout tree,
the mods the layout adds, the keys it expects, a recipe and a screenshot.
Read `CONTRIBUTING.md` in the repo root first.

## Create the layout

From the repo root:

```
python3 scripts/new-layout.py <slug>
```

The generator copies this folder to `layouts/<slug>/`, replaces the template
placeholder in file contents and in file and folder names, and prints the next
steps. It refuses an invalid slug and a folder that already exists.

To do it by hand:

```
cp -R layouts/_template layouts/<slug>
```

Then rename the copies and replace the placeholder in every file name, folder
name and file content. The JSON files, the mod and the keys are small, so a
text search for the placeholder is enough to find every hit.

## What to edit

- `layouts/{{slug}}.json` is the window: node types, block ids, sizes and root
  properties such as `titlebar` and `background`. The layout format is in
  `~/.config/herdr-app/AGENTS.md`, next to your Herdr install.
- `mods/{{slug}}-example/main.js` is a small mod. For real work start from a
  shipped mod instead:

  ```
  herdr-app do mod.clone --name tabs --as {{slug}}-tabs
  ```

  Point the layout's `content.mod` at the new folder and keep `cloned_from` in
  `mod.json` truthful.
- `keys.json` is a snippet, not a file to copy over the person's keys. Merge its
  sections and keys into `~/.config/herdr-app/keys.json`. Ask before replacing a
  key the person already uses.
- `RECIPE.md` is the brief another agent could rebuild the layout from. Fill in
  every `<...>` placeholder. Keep the order: what you see, how it behaves, built
  from, watch out, done when.
- `preview.png` is required for a shared layout. Run the layout in Herdr and
  save a screenshot:

  ```
  herdr-app shot layouts/{{slug}}/preview.png
  ```

  Crop it to the window if the full frame is too large.

## Check it

Check every mod in the folder:

```
for mod in layouts/{{slug}}/mods/*/; do herdr-app check "$mod"; done
```

`herdr-app check` writes `gpui-kit.d.ts` and `jsconfig.json` next to each mod
for editors. Both files are generated and ignored by git. Do not commit them.

Then install it and look at it:

```
cp layouts/{{slug}}/layouts/{{slug}}.json ~/.config/herdr-app/layouts/
cp -R layouts/{{slug}}/mods/* ~/.config/herdr-app/mods/
# merge layouts/{{slug}}/keys.json into ~/.config/herdr-app/keys.json by hand
herdr-app do layout.switch --name {{slug}}
```

Herdr reloads a mod when its files change. If the window shows an error, run
`herdr-app status` to read it.

## Do not commit

- `gpui-kit.d.ts` and `jsconfig.json` (generated per mod)
- anything under `~/.config/herdr-app`
- `layouts/.state/` (Herdr writes it)
- secrets, tokens or machine paths

## Before the pull request

- No template placeholder left in the folder.
- Every mod passes `herdr-app check`.
- The layout shows after `layout.switch` with no layout error file.
- `preview.png` shows the real window, and `RECIPE.md` has no `<...>` left.
