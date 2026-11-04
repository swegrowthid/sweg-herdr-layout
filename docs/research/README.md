# Research

Research notes and decision inputs for the SWEG layouts. They are kept as the
record behind the current design. They are not updated with the repo.

## Historical note

The repo and its layouts were renamed after most of these documents were
written, so the documents still use the old names:

| Old name | Current name |
| -------- | ------------ |
| layout `sweg-focus` | layout `sweg` |
| mod `sweg-focus-*` (for example `sweg-focus-panel`, `sweg-focus-tabs`) | mod `sweg-*` (for example `sweg-panel`, `sweg-tabs`) |
| helper `px0_workspace.py` | helper `px0-workspace.py` |
| terminal menu mod `sweg-menu` (old tree) | `sweg-terminal-menu` (the `sweg-menu` folder now holds the workspace popup) |

Read the old names as the current ones. Links inside the documents point at
the old paths and can be dead. Do not rewrite a document to match the rename;
add a new note instead.

## Documents

| Document | What it covers |
| -------- | -------------- |
| [herdr-gpui-px0-workspace.md](herdr-gpui-px0-workspace.md) | px0 in Sheprd (herdr-gpui): webview browser tabs, the deep-link flow, and what "open file" means there. |
| [herdr-app-px0-pane-options.md](herdr-app-px0-pane-options.md) | Herdr 0.1.12 pane, tab and file viewer options for a px0 workspace, the missing browser pane, and the status of PR #235. |
| [px0-open-file.md](px0-open-file.md) | The tested open-file surfaces of px0 0.1.20: no way to open a file in an already open px0 tab. |
| [px0-profile.md](px0-profile.md) | Efficiency profile of px0 0.1.20: start time, processes, memory, features, and embed limits. |
| [20261104-px0-workspace-web-editor-options.md](20261104-px0-workspace-web-editor-options.md) | Options and recommendation for a px0 web editor workspace in Herdr. |
| [20261104-workspace-custom-vs-px0.md](20261104-workspace-custom-vs-px0.md) | Decision input: keep the custom Files and Git workspace rail, or move to px0. |
| [custom-mods-cost-audit.md](custom-mods-cost-audit.md) | Runtime cost and clone drift audit for the custom workspace mods (Herdr 0.1.12). |

Screenshots of the px0 missing, installed and settings states are in
[screenshots/](screenshots/).
