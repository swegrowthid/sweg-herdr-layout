# sweg

Files, Git and px0 as a full-height workspace rail beside the terminal, not a
card inside the tab area. The rail follows the active space's repo, not the
focused pane, and docks left (default) or right from `settings.json` or its
header menu. It has two workspace modes: custom Files and Git panels inside
the rail, or the px0 editor window outside Herdr. The layout's own settings
page switches between them.

![sweg](preview.png)

## What you see

- Left sidebar, 268 px (`chrome`): brand row (46 px), Spaces and Agents
  sharing the height, footer row (69 px). No Files/Changes panel.
- Workspace rail, 344 px default (min 300, max 480), a root column: full
  window height, from the tab bar's top edge to the bottom. Header 40 px
  (active view icon and label, chevron, settings gear, hide button), content,
  footer 28 px (folder, branch, change counts). It docks right after the
  sidebar (left) or as the last column (right).
- The rail's head/foot draw `bg(chrome)`, `radius` 10 and a 1 px `border`;
  the content mods paint the chrome background and side borders.
- Header click opens a popup that follows the active workspace mode: Files and
  Git rows for `custom`, a px0 row for `px0`, then `Workspace settings` and a
  `Dock` row with `Left` and `Right`. Active rows show a check. The gear (or
  `cmd-shift-,`) opens the settings page directly. The popup never lists the
  view rows of the other mode.
- Work column: shipped-style tab bar without Files/Changes buttons, a `+`
  that hugs the last tab, and a `Workspace` button at the right. Terminal pane
  uses `sweg-pane` (`</>` plus split/zoom/close on hover). Status bar
  unchanged.
- Look comes from the person's `settings.json`; reference build is `graphite`
  with the Gruvbox palette and Kode Mono.

## How it behaves

- Dock side: `shared("workspace.dock")` is the truth; the menu toggle writes
  it. `settings.json` `"workspace_dock": "left" | "right"` is the seed for a
  fresh home, read only while the shared key is missing. The rail moves
  without a restart: `sweg-tabs` reorders the layout with `layout.set`.
- `settings()` drops keys Herdr does not know, so the file is read with
  `readTextFile(appHome() + "/settings.json")`. Herdr rewrites that file from
  its own struct on some saves (zoom, settings screen) and drops unknown keys,
  which is why the shared pick wins. After a move, `sweg-tabs` writes
  the key back into settings.json once per value, best effort.
- The menu's `Left` / `Right` writes the shared pick and runs
  `sweg-tabs.reload_dock`, so the move is immediate; a 2 s timer is the
  fallback.
- Workspace mode: `shared("workspace.mode")` = `"custom"` or `"px0"` is the
  truth; `"custom"` shows the last custom view (`shared("workspace.custom.view")`,
  default `"ws-files"`), `"px0"` shows `ws-px0`. The layout settings page and
  the header popup write it. `settings.json` keys `workspace_mode` and
  `workspace_custom_view` are seeds for a fresh home only.
- The header popup lists only the active mode's view rows: Files and Git for
  custom, px0 for px0. Switching mode happens in the settings page, so the
  popup never offers a mode it cannot show. Its height is computed by
  `sweg-panel`'s `menuHeight()` (custom 209 px, px0 167 px).
- px0 tool check: `sweg-px0` runs `px0-workspace.py --check` once at
  init and again from `Check again`. The helper reports install state, path,
  version, and workbench liveness. The result goes to shared keys
  `px0.installed`, `px0.path`, `px0.version`, `px0.workbench`.
- When px0 is not installed, the px0 view shows a setup card with the install
  command (`curl -fsSL https://px0.ai/install.sh | sh`); `Open workspace` and
  `Split` stay disabled. The settings page marks the px0 mode row red with the
  same command. When installed, the px0 view adds a small version line such as
  `px0 0.1.20 · 127.0.0.1:7777`.
- The layout settings page (`sweg-settings`, overlay dialog) is the
  settings UI for this layout: workspace mode, px0 window style (browser tab
  or Chrome app window), and dock side. Herdr's own Settings window only has
  fixed sections (look, alerts, updates) and no API for mods to add rows, so
  this page exists. `cmd-shift-,` or the gear opens it. The dialog is 404 px
  high so the not-installed warning line fits.
- Workspace content follows the space's repo: the first terminal in the space
  with a live folder, else the space's own folder. Switching panes or tabs
  inside the space does not move the rail (Orca's per-worktree explorer, Zed's
  and VS Code's per-workspace panels). Switching spaces follows.
- Header click -> `openOverlay` popup (`sweg-menu`). Choose ->
  `layout.select {stack: "workspace-body", child: "ws-files" | "ws-git" |
  "ws-px0"}` then `layout.show {id: "workspace"}`.
- `Workspace` tab-bar button -> `layout.toggle {id: "workspace"}`. The
  rail header's hide button does the same; its icon flips with the dock side.
- `cmd-shift-b` -> `layout.toggle:workspace` (the app's own command), works
  while the rail is hidden because the key does not go through a mod.
- `cmd-shift-f`, `cmd-shift-g`, `cmd-shift-x` -> `sweg-panel.files`,
  `.git`, `.px0`. The panel head handles these while the rail is shown. `f`
  and `g` also set the custom mode and remember the view; `x` sets px0 mode.
- `cmd-shift-,` -> `mod.open:sweg-settings` opens the layout settings
  page.
- `cmd-shift-e` -> `sweg-pane.open_editor` (the px0 button/key on a pane).
  That one stays pane-based: it opens the focused pane's folder.
- Files: tree of the space's repo. Click a file for a 34 px preview bar and
  the read-only editor.
- Git: changed-file list, diff, commit bar; the footer shows counts and
  `+add / -del`.
- px0 view (Option A): install/workbench status from
  `px0-workspace.py --check`, the space folder, `Open workspace`, and a legacy
  `Split` fallback. `Open workspace` calls the helper, which discovers or
  starts the px0 workbench, pre-warms the child workspace for the space's
  repo, and prints the deep-link URL (`<workbench>/w/<id>/`). The mod then
  runs `open` on that URL in the default browser, or in a Chrome app window
  when the settings page picks `App window`. No terminal pane is created.
  `Split` keeps the old `px0 <dir> -port 0` terminal session as a fallback.
  If px0 is missing, the view shows a setup card and does not enable the
  launcher.
- Footer: branch, status and diff every 5 s with `--no-optional-locks`. A
  non-repository folder shows `No repository`.

## Built from

- `layouts/sweg.json`: clone of `main` 0.1.12. Root `row` children are
  `sidebar`, `workspace`, `work`. `workspace` (ids `workspace`,
  `workspace-head`, `workspace-body`, `workspace-foot`; stack children
  `ws-files`, `ws-git`, `ws-px0`) is a root column, full height. `work` holds
  `tabs` (`sweg-tabs`), `work-body` with only `main` (`tab: active`,
  `sweg-pane` header) and `status`. Root `terminal_menu` is `sweg-terminal-menu`.
- `mods/sweg-tabs`: clone of `tabs` 0.1.12. Drops `shared` panel
  syncing and the Files/Changes buttons; adds the `Workspace` button, the
  `+` inside the tab-scroll row, the dock logic, and the workspace mode:
  `readSettings()` (one settings.json read per launch), `pick()` (shared
  first, settings seed second), `applyDock()`, `applyMode()` (selects
  `ws-px0` for px0 mode or the remembered custom view), run from `init`, a
  2 s `cx.timer`, and the `reload_dock` / `reload_mode` commands. Shared keys
  are the truth; `settings.json` keys are written back once per value.
- `mods/sweg-panel`: two copies in the layout (`props.part` head/foot).
  Head: title, chevron, settings gear, hide (icon follows the dock side),
  popup, plus `pl(lightsPadding)` when the rail is the first column so the
  macOS window buttons keep their room. Foot: folder, branch chip, changes
  and `+/-`, the git timer. `location()` reads the space repo via `place()`,
  not the focused pane.
- `mods/sweg-menu`: popup filtered to the active mode's view rows
  (Files/Git for custom, px0 for px0), a `Workspace settings` row, and the
  `Dock` row. `choose()` writes the shared mode/view and runs `layout.select`
  + `reload_mode`; `dock()` writes the shared dock and runs `reload_dock`.
  Both are synchronous, because the overlay is torn down right after the
  click.
- `mods/sweg-settings`: overlay dialog with workspace mode, px0 window
  style, and dock. Picks go to shared state, then `reload_mode` /
  `reload_dock`. It exists because Herdr's Settings window has fixed sections
  and no mod extension point. On open it runs the px0 `--check` again, so the
  warning reflects an install done while Herdr was open.
- `mods/sweg-px0`: px0 view + `px0-workspace.py` helper. The helper's
  `--check` prints install/path/version/workbench JSON and never starts a
  workbench. Watches `~/.px0`, has no fast data timer (the old 4 s
  `cx.notify()` was removed); a 15 s fallback refresh runs only while
  `ws-px0` is the active view.
- `mods/sweg-files`, `mods/sweg-changes`: clones of `files` and
  `changes` 0.1.12, headless (no 42 px card header; Files keeps a 34 px
  preview bar). Both use the same space-level `place()` / `location()`.
- `mods/sweg-pane` / `mods/sweg-terminal-menu`: clones of `pane` and `menu`,
  first written for the earlier sidebar build. The `builtin` editor branch
  checks `workspace-body` first, then `panel-body`.
- `keys.json` snippet: `cmd-shift-b` toggle, `cmd-shift-f/g/x` mode and
  views, `cmd-shift-,` settings, `cmd-shift-e` editor. Merge, don't replace.
- Shipped mods used: `workspace-chrome`, `spaces`, `agents`,
  `workspace-status`, `system-stats`; icons from `mods/workspace-chrome/*.svg`,
  `mods/files/folder.svg`, `mods/sweg-pane/code.svg`.
- Programs: `px0` (https://px0.ai) and `python3` (for the workspace helper).

## Watch out

- `layout.set` replaces the whole tree of a personal layout and persists it to
  `layouts/<name>.json`. Always pass the full `layout()` tree (deep-cloned);
  a partial tree loses nodes. `applyDock()` must stay idempotent: it compares
  the node's current index and skips when already in place, or the 2 s timer
  rewrites the layout forever.
- A popup/overlay mod is torn down as soon as `closeOverlay` runs; async work
  started in that click (file reads or writes) never resumes. Keep the
  click handler synchronous and let a persistent mod (`sweg-tabs`) do
  the async part. This broke the first Dock toggle build.
- `readDock()` must read `shared("workspace.dock")` first. With settings.json
  first, a stale `"left"` left in the file shadowed every later shared pick
  and the toggle looked dead.
- Every `run("<mod>.<command>")` needs the mod to be loaded and listening;
  `reload_dock` is best effort, the 2 s timer is the real guarantee.
- `settings.json` is not a safe store for custom keys: Herdr serializes its
  own `Person` struct back to the file on some saves and drops unknown keys.
  Read it as a seed, keep `shared("workspace.dock")` / `shared("workspace.mode")`
  as the truth, and never rely on the key surviving a zoom change.
- The app's settings screen (`cmd-,`) is the shipped `frame/settings` mod,
  rewritten on every start. A mod cannot add a row there: `app.settings` only
  accepts `look`, `alerts`, `updates`. The layout's own settings page
  (`sweg-settings`) is the settings UI for this layout.
- `applyMode()` must only call `layout.select`; calling `layout.show` there
  would unhide a rail the person hid on purpose. The menu may show it.
- The px0 helper writes nothing under `.git`; it uses the px0 workbench API.
  `POST /api/wb/open` needs `Origin` equal to the workbench host and is
  loopback-only. Compute the workspace id from `realpath`, or a symlinked
  path (for example `/tmp` vs `/private/tmp`) starts a second workspace.
- The deep link (`<workbench>/w/<id>/`) is read when the page loads. Pre-warm
  the child first (the helper does), or a cold child answers with a holding
  page and the workspace does not open. The URL opens a new browser tab or
  app window; no automation is used to focus an existing one.
- `open -na "Google Chrome" --args --app=<url>` looks like a standalone
  editor window but creates a new app window per call; that is why the
  default stays `Browser tab`.
- Install detection lives in the helper: `shutil.which("px0")` first, then
  `~/.local/bin/px0`. The version call has a 3 s timeout; `--check` uses the
  existing lock read plus ping, so it never starts a workbench. Keep the JSON
  shape stable: the px0 view and settings mod both parse it.
- The settings dialog is 404 px high. The not-installed warning adds a line;
  at 384 px the bottom help line was clipped. If you add another settings row,
  raise the height too.
- The menu popup height is computed by `sweg-panel`'s `menuHeight()`.
  If you add or remove a view row, update the `MENU` constants, or the dock
  row clips (custom 209 px, px0 167 px).
- Editing `px0-workspace.py` does not reload the px0 mod. Touch
  `sweg-px0/main.js` (or reopen the settings page) to re-run the check
  after a helper change.
- Keep the ids `workspace`, `workspace-head`, `workspace-body`,
  `workspace-foot`, `ws-files`, `ws-git`, `ws-px0`. The head, menu, tabs mod
  and keys find them by id. `layout.toggle:workspace` uses the node id.
- Dock left with the sidebar hidden makes the rail the first column: the head
  must keep the traffic-light padding or the macOS window buttons sit over
  the title. The tab bar computes its own padding the same way.
- The head and foot are the same mod; only the head handles view keys, the
  foot runs the git timer. Both copies consume `nextCommand`.
- View keys only work while the rail is shown; `cmd-shift-b` and the tab-bar
  button work always because they are app commands.
- px0 is started with `-port 0`; the argv port is `0`. Sessions are matched
  by argv, not cwd, because a split pane inherits the source pane's cwd.
- The footer's git reads use `--no-optional-locks` and
  `core.fsmonitor=false`; keep them so the folder watch and status do not
  fight.
- Herdr 0.1.12 has no browser pane; the px0 tab stays a launcher and px0
  opens the system browser.

## Done when

- `herdr-app check` passes on every mod in `mods/`.
- `layout.switch {name: "sweg"}` shows no `layout.error`: sidebar,
  full-height workspace rail, terminal, status bar.
- With `"workspace_dock": "left"` the rail sits between sidebar and terminal;
  with `"right"` it is the last column; the move happens within ~2 s with no
  restart.
- The menu's `Dock` row moves the rail immediately and updates both
  settings.json and shared.json.
- The settings page opens from the gear and `cmd-shift-,`, shows the current
  mode/window/dock, and switching mode changes the rail within ~2 s and
  survives a layout switch away and back.
- The header popup shows only the active mode's view rows: custom shows
  Files and Git, px0 shows px0; the settings and dock rows stay in both.
- With px0 installed the px0 view shows a version line and enables the
  launcher. With px0 missing (or `PATH` and `HOME` hidden in a simulation) the
  view shows the setup card and install command, the settings page marks the
  px0 mode row red, and the dialog bottom line is not clipped.
- `Check again` flips the view between the setup card and the launcher after
  px0 is installed or hidden, without a restart.
- px0 mode shows the px0 view with workbench status and `Open workspace`;
  the helper prints one URL for the space repo and the same repo reuses one
  workspace child. `Split` still starts the legacy terminal session.
- The px0 view keeps no 4 s notify timer; its fallback refresh runs only
  while `ws-px0` is the active view.
- Focusing another pane or opening a tab in a different folder does not
  change the rail's folder; switching spaces does.
- `cmd-shift-b` and the tab-bar `Workspace` button hide and show the rail.
- `cmd-shift-f`, `cmd-shift-g`, `cmd-shift-x` switch views and mode while the
  rail is shown.
- Files opens a file and returns with the back arrow; Git lists changes,
  shows a diff and can commit.
- `preview.png` is a screenshot of the live layout.
