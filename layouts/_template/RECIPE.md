# {{slug}}

<One paragraph: what the person sees and why this layout exists. Name the
regions and the idea in one or two sentences.>

![{{slug}}](preview.png)

## What you see

- `<Region, its size in px, its color and type, and what it shows.>`
- `<Next region, the same way.>`

## How it behaves

- `<Click, key or hover>`: `<what happens>`.
- Agent status: `<how working, blocked, done and idle look>`.
- `<What moves, resizes or hides, and what remembers it.>`

## Built from

- `layouts/{{slug}}.json`: `<node types, block ids, sizes and root
  properties>`.
- `mods/{{slug}}-example`: `<props roles, herdr functions it imports, commands
  it runs, programs it starts>`.
- Shipped mods used unchanged: `<list>`.
- `keys.json`: `<sections and keys>`.

## Watch out

- `<What tripped the build up, sizes and limits, what a fresh build would get
  wrong.>`
- `<What the layout assumes about the person's setup.>`

## Done when

- `herdr-app check layouts/{{slug}}/mods/{{slug}}-example` passes.
- `herdr-app do layout.switch --name {{slug}}` shows `<expected window>`.
- `<Each visible behavior a build must show, one line each.>`
