# herdr-layouts

Custom window layouts for [Herdr](https://herdr.dev) (desktop app).

Herdr keeps its layout, sidebar, tabs, keys and themes as plain files in
`~/.config/herdr-app`. A **layout** is a whole window: what goes where and how it
looks. This repo is a collection of layouts built for the desktop version — copy
one, switch to it, or ask your agent to remix it.

## Layouts

| Layout | Description |
| ------ | ----------- |
| [sweg](layouts/sweg/) | `main` remix: Files/Changes panel inside the left sidebar, `</>` button + `cmd-shift-e` + right-click item open the pane's folder in a code editor (px0). |
| [sweg-focus](layouts/sweg-focus/) | `sweg` remix: Files, Git and px0 in a 344 px workspace card beside the sidebar, one header switcher, `cmd-shift-b` toggle. |

Each layout lives in its own folder, laid out like `~/.config/herdr-app`:

```
layouts/<name>/
├── layouts/<name>.json   the layout file
├── mods/<mod>/           mods it adds (cloned and customized)
├── keys.json             keys it expects (merge, don't replace)
├── RECIPE.md             the brief another agent could build it from
└── preview.png           screenshot
```

## Installing a layout

Fastest way — let your agent do it. Point it at the repo, or at a single layout:

```
❯ Read ~/.config/herdr-app/AGENTS.md, then add this layout: github.com/<you>/herdr-layouts/<name>
```

Your agent reads every file first, adds the layout next to yours and switches to
it. Yours stays as it is.

Manual way — copy the layout file and each mod folder into your config, then
merge the keys snippet:

```sh
cp layouts/<name>/layouts/<name>.json ~/.config/herdr-app/layouts/
cp -R layouts/<name>/mods/* ~/.config/herdr-app/mods/
# merge layouts/<name>/keys.json into ~/.config/herdr-app/keys.json by hand
for mod in layouts/<name>/mods/*/; do herdr-app check "$mod"; done
herdr-app do layout.switch --name <name>
```

Herdr picks it up automatically. Switch between layouts with `ctrl-shift-l`.

> Herdr doesn't review community layouts. Always have your agent read the files
> before adding one.

## Building your own

1. Ask your agent to write it up. From inside Herdr, paste:

   ```
   Read ~/.config/herdr-app/AGENTS.md, then write a RECIPE.md for my <name>
   layout the way it describes: a brief another agent could build it from with
   an empty folder. Put the layout, its mods, the recipe and a screenshot named
   preview.png in one folder.
   ```

2. Add the folder to `layouts/` in this repo and open a PR.

3. To share it publicly, push it to a public GitHub repo with the topic
   `herdr-layout` — it will show up on [herdr.dev/layouts](https://herdr.dev/layouts/)
   under Community within the hour.

## Links

- [Herdr](https://herdr.dev)
- [Layouts gallery](https://herdr.dev/layouts/)
- [Guide](https://herdr.dev/guide/)
- [AGENTS.md — the guide your agent reads](https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md)
- [herdr-app source](https://github.com/herdrdev/herdr-app)
- [Discord](https://discord.gg/PsgRfzmUDg)
