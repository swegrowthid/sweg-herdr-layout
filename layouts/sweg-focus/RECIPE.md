# sweg-focus

`sweg` with a workspace card beside the sidebar: Files, Git and px0 in one
344 px card, switched from its header. Files and Changes leave the sidebar.
The sidebar keeps Spaces, Agents and the footer.

![sweg-focus](preview.png)

## What you see

- Left sidebar, 268 px (`chrome`): brand row (46 px), Spaces and Agents
  sharing the height, footer row (69 px). No Files/Changes panel.
- Workspace card, 344 px (min 300, max 480), inside `work-body` between the
  sidebar and the terminal. Header 40 px (active view icon and label,
  chevron, hide button), content, footer 28 px (folder, branch, change
  counts). The card has a 1 px `border`, `radius` 10 and a `chrome`
  background.
- Header click opens a popup with Files, Git and px0. The active row has a
  check. Choosing a row switches the stack child and shows the card.
- Main column: shipped tab bar without the old Files/Changes buttons, plus a
  `Workspace` button at the right. Terminal pane uses `sweg-pane` (the `</>`
  button and split/zoom/close on hover). Status bar unchanged.
- Look comes from the person's `settings.json`; reference build is `graphite`
  with the Gruvbox palette and Kode Mono.

## How it behaves

- Header click -> `openOverlay` popup (`sweg-focus-menu`). Choose ->
  `layout.select {stack: "workspace-body", child: "ws-files" | "ws-git" |
  "ws-px0"}` then `layout.show {id: "workspace"}`.
- `Workspace` tab-bar button -> `layout.toggle {id: "workspace"}`. The
  workspace header's hide button does the same.
- `cmd-shift-b` -> `layout.toggle:workspace` (the app's own command). This
  works while the card is hidden, because the key does not go through a mod.
- `cmd-shift-f`, `cmd-shift-g`, `cmd-shift-x` -> `sweg-focus-panel.files`,
  `.git`, `.px0`. The panel head handles these while the card is shown.
- `cmd-shift-e` -> `sweg-pane.open_editor` (the existing px0 button/key).
- Files: tree of the focused pane's folder. Click a file for a 34 px preview
  bar (back arrow, file path, "preview") and the read-only editor. The footer
  keeps the folder and branch.
- Git: changed-file list, diff, commit bar. The old inner header is gone; the
  footer shows the count and `+add / -del`.
- px0: launcher. Status (Running/Idle), current folder, `Open px0`, `Split`,
  and sessions found from `terminals()` whose argv runs px0. `Open px0`
  focuses an existing px0 pane for the folder, else splits a pane running
  `px0 <dir> -port 0`. px0 opens the system browser. `Split` always starts a
  new pane. The hint names `⌘⇧E` and the no-browser-pane limit.
- Footer: reads the branch, status and diff every 5 s with
  `--no-optional-locks`. It keeps the last folder while a popup or overlay
  has focus. A non-repository folder shows `No repository`.
- `sweg-pane` and `sweg-menu` keep the `</>` button, the `cmd-shift-e` key
  and the right-click "Open in px0" item. Their `builtin` editor branch
  checks for `workspace-body` first and falls back to `panel-body`, so the
  old `sweg` layout still opens its sidebar panel.

## Built from

- `layouts/sweg-focus.json`: clone of `main` 0.1.12. The sidebar is `sweg`'s
  sidebar without the `panel` block. `work-body` is a row with the
  `workspace` column (ids `workspace`, `workspace-head`, `workspace-body`,
  `workspace-foot`; stack children `ws-files`, `ws-git`, `ws-px0`) and the
  unchanged `main` block. The tab block uses `sweg-focus-tabs`; the pane
  header uses `sweg-pane`; the root `terminal_menu` is `sweg-menu`.
- `mods/sweg-focus-tabs`: clone of `tabs` 0.1.12. Drops `shared`,
  `syncPanel` and the Files/Changes buttons. Adds the `Workspace` button,
  which reads `workspace.hidden` from `layout()` and runs `layout.toggle`.
- `mods/sweg-focus-panel`: two copies in the layout (`props.part` is `head`
  or `foot`). Head: title, chevron, hide, popup. Foot: folder, branch chip,
  changes and `+/-`; timer and git reads. The head handles the view keys; the
  foot runs the footer timer. The head opens `sweg-focus-menu` as a popup at
  the pointer.
- `mods/sweg-focus-menu`: popup with the three views, descriptions and a
  check on the active row. Choosing closes the overlay, selects the stack
  child and shows the workspace.
- `mods/sweg-focus-files`: clone of `files` 0.1.12. Headless: no 42 px card
  header; a 34 px preview bar only when a file is open. The root paints the
  card's `chrome` background and its left/right borders.
- `mods/sweg-focus-changes`: clone of `changes` 0.1.12. Headless: no 42 px
  card header; list, diff and commit bar remain. The footer carries the
  counts. The root paints the card background and side borders.
- `mods/sweg-focus-px0`: launcher view. Reads the focused cwd, finds px0
  terminals by argv, focuses or splits. A 4 s timer refreshes the session
  list. The view states the no-browser-pane limit.
- `mods/sweg-pane` / `mods/sweg-menu`: copies of the `sweg` mods, with the
  `builtin` branch checking the workspace stack first. The `sweg` layout's
  copies are updated the same way; both layouts work.
- `keys.json` snippet: `cmd-shift-b` direct toggle, `cmd-shift-f/g/x` view
  commands, `cmd-shift-e` editor. Merge, don't replace.
- Shipped mods used: `workspace-chrome`, `spaces`, `agents`, `workspace-status`,
  `system-stats`; the shipped `tabs`/`files`/`changes` folders provide icons
  and the original code for the clones. `mods/workspace-chrome/*.svg`,
  `mods/files/folder.svg`, `mods/sweg-pane/code.svg`, `mods/sweg-pane/split-right.svg`.
- Programs: `px0 <dir> -port 0` (optional external tool, https://px0.ai) and
  whatever `settings.json` `code_editor` names.

## Watch out

- The workspace column is a plain container. It has no background, border or
  radius. The head and foot draw `bg(chrome)`, `rounded(10)` and a 1 px
  border; the content mods draw the background and left/right border. The
  directional `rounded_t` / `rounded_b` calls did not render on the head and
  foot; use `.rounded(10)`. The inner corners are hidden by the content's
  chrome background.
- Keep the ids `workspace`, `workspace-head`, `workspace-body`,
  `workspace-foot`, `ws-files`, `ws-git`, `ws-px0`. The head, menu and keys
  find them by id.
- The head and foot are the same mod. Only the head handles view keys; the
  foot must ignore them. The foot runs the git timer. Both copies consume
  `nextCommand`.
- The view keys only work while the card is shown. The card is hidden -> the
  panel mod is hidden and does not receive commands. `cmd-shift-b` is the
  app's direct `layout.toggle:workspace`, so it always works. The tab-bar
  `Workspace` button also always works.
- `layout.toggle:workspace` uses the node id, not the stack id. Do not rename
  the node.
- The Files/Changes clones have no inner header. Do not add one; the
  workspace header is the only title. The Files preview bar is the only way
  back from a file.
- px0 is started with `-port 0`, so the argv port is usually `0`. The view
  shows `auto`; do not parse a real port from argv.
- px0 sessions are matched by argv, not by cwd. A split pane inherits the
  source pane's cwd, so cwd is not enough.
- The footer's git reads use `--no-optional-locks` and
  `core.fsmonitor=false`. Keep them; the folder watch and status must not
  fight each other. The footer keeps the last folder when `focused()` has no
  pane (popup/overlay).
- The `sweg-pane` / `sweg-menu` copies are shared with the `sweg` layout.
  Keep the `builtin` fallback. The old `sweg` layout has no `workspace-body`,
  so it selects `panel-body` / `files` / `panel`.
- Herdr 0.1.12 has no browser pane and no plugin system. `herdr-browser`
  (StructuPath, ogulcancelik, salamituns) requires Herdr 0.7+ or 0.9+ and a
  Kitty-graphics terminal. Carbonyl is a terminal Chromium; it can run in a
  terminal pane, not inside this card, and its macOS build is unsigned and
  frozen. The px0 tab stays a launcher in this layout.
- The tab bar's `Workspace` button reads `workspace.hidden`. If the node is
  removed, the button stays off; keep the node.

## Done when

- `herdr-app check` passes on every mod in `mods/`.
- `layout.switch {name: "sweg-focus"}` shows no `layout.error`: sidebar
  without Files/Changes, workspace card, terminal, status bar.
- Header click opens the switcher; choosing Files, Git and px0 changes the
  card; the title and footer follow.
- `cmd-shift-b` hides and shows the card while hidden; the tab-bar
  `Workspace` button does the same.
- `cmd-shift-f`, `cmd-shift-g`, `cmd-shift-x` switch views while the card is
  shown.
- Files opens a file and returns with the back arrow.
- Git lists changes, shows a diff and can commit.
- px0 `Open px0` focuses an existing session or starts one; `Split` starts a
  new one; the footer stays on the folder while a popup is open.
- `preview.png` is a screenshot of the live layout.
