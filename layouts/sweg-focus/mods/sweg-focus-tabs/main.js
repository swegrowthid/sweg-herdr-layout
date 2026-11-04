// Top tab bar for the sweg-focus layout: the shipped tabs, without the old
// Files/Changes panel buttons. One Workspace button shows and hides the
// workspace rail. The same mod applies the rail's dock side and its workspace
// mode (custom Files/Git panels or the px0 editor window).

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, layout, settings, shared, appHome, readTextFile, writeTextFile, nextCommand } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The file is the seed for a fresh home; shared.json is the runtime truth.
// Herdr drops unknown keys when it rewrites settings.json itself, so a file
// value is only read while the shared pick is missing. One read per launch.
async function readSettings() {
  try {
    const raw = await readTextFile(`${appHome()}/settings.json`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function pick(settingsFile, key, allowed, fallback) {
  const value = shared(key);
  if (allowed.includes(value)) return value;
  const seeded = settingsFile?.[key.replaceAll(".", "_")];
  return allowed.includes(seeded) ? seeded : fallback;
}

export default class Tabs extends View {
  init(_props, cx) {
    this.pressed = null;
    this.dock = null;
    this.mode = null;
    this.view = null;
    this.saved = new Set();
    this.settingsFile = readSettings();
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "reload_dock") await this.applyDock(cx, await this.settingsFile);
        else if (command === "reload_mode") await this.applyMode(cx, await this.settingsFile);
      }
    });
    cx.spawn(async (cx) => this.applyState(cx));
    cx.timer.every(2000, (cx) => this.applyState(cx));
  }

  async applyState(cx) {
    const settingsFile = await this.settingsFile;
    await this.applyDock(cx, settingsFile);
    await this.applyMode(cx, settingsFile);
  }

  // The workspace rail is a root child: right after the sidebar (left) or last (right).
  async applyDock(cx, settingsFile) {
    const want = await pick(settingsFile, "workspace.dock", ["left", "right"], "left");
    if (want === this.dock) return;
    const tree = JSON.parse(JSON.stringify(layout()));
    const root = tree;
    if (!root?.children) return;
    const ws = root.children.find((c) => c.id === "workspace");
    if (!ws) return;
    const rest = root.children.filter((c) => c.id !== "workspace");
    const at = want === "right" ? rest.length : Math.max(0, rest.findIndex((c) => c.id === "sidebar") + 1);
    if (root.children.indexOf(ws) === at) {
      this.dock = want;
      this.syncSettings("workspace_dock", want);
      return;
    }
    root.children = [...rest.slice(0, at), ws, ...rest.slice(at)];
    run("layout.set", { layout: tree });
    this.dock = want;
    this.syncSettings("workspace_dock", want);
    cx.notify();
  }

  // The mode picks which child of the workspace-body stack is shown. Custom
  // mode remembers the last custom view; px0 mode always shows ws-px0.
  async applyMode(cx, settingsFile) {
    const want = await pick(settingsFile, "workspace.mode", ["custom", "px0"], "custom");
    const customView = await pick(settingsFile, "workspace.custom.view", ["ws-files", "ws-git"], "ws-files");
    const child = want === "px0" ? "ws-px0" : customView;
    const stack = find(layout(), "workspace-body");
    if (!stack) return;
    const changed = this.mode !== want || this.view !== customView;
    this.mode = want;
    this.view = customView;
    this.syncSettings("workspace_mode", want);
    this.syncSettings("workspace_custom_view", customView);
    if (stack.active !== child) run("layout.select", { stack: "workspace-body", child });
    if (changed) cx.notify();
  }

  // Keeps settings.json readable for people who look there. Best effort and
  // once per value: Herdr may rewrite the file without unknown keys, and a
  // repeated write would then loop. shared.json stays the truth either way.
  syncSettings(key, value) {
    const token = `${key}:${value}`;
    if (this.saved.has(token)) return;
    this.saved.add(token);
    const path = `${appHome()}/settings.json`;
    (async () => {
      try {
        const raw = await readTextFile(path);
        if (raw === null) return;
        const json = JSON.parse(raw);
        if (json[key] === value) return;
        json[key] = value;
        await writeTextFile(path, JSON.stringify(json, null, 2) + "\n", raw);
      } catch {
        // The app may hold the file; the shared pick still applies.
      }
    })();
  }

  render() {
    const t = theme();
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), workspace = find(root, "workspace"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const workspaceOn = Boolean(workspace && !workspace.hidden);
    const workspaceButton = h_flex().id("workspace-toggle").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
      .bg(workspaceOn ? t.selected : t.chrome).text_color(workspaceOn ? t.foreground : t.muted)
      .hover(s => s.bg(t.hover))
      .on_mouse_down("left", stop)
      .on_click(() => run("layout.toggle", { id: "workspace" }))
      .child(svg("mods/workspace-chrome/panel-left.svg").size(14))
      .child(div().font_semibold().text_size(13).child("Workspace"));
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children([...shown.map(item), button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))]))
      .child(workspaceButton)
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}
