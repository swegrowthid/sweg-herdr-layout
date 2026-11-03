# herdr-layouts

Custom window layouts for [Herdr](https://herdr.dev) (desktop app).

Herdr keeps its layout, sidebar, tabs, keys and themes as plain files in
`~/.config/herdr-app`. A **layout** is a whole window: what goes where and how it
looks. This repo is a collection of layouts built for the desktop version — copy
one, switch to it, or ask your agent to remix it.

## Layouts

| Layout | Description |
| ------ | ----------- |
| —      | Nothing here yet. |

Each layout lives in its own folder:

```
layouts/<name>/
├── <name>.json    the layout file
├── mods/          mods it depends on (optional)
├── RECIPE.md      the brief another agent could build it from
└── preview.png    screenshot
```

## Installing a layout

Fastest way — let your agent do it. Point it at the repo, or at a single layout:

```
❯ Read ~/.config/herdr-app/AGENTS.md, then add this layout: github.com/<you>/herdr-layouts/<name>
```

Your agent reads every file first, adds the layout next to yours and switches to
it. Yours stays as it is.

Manual way — drop the layout file into your config:

```sh
cp layouts/<name>/<name>.json ~/.config/herdr-app/layouts/
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
