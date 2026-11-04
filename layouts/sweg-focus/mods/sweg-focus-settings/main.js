// Workspace settings for the sweg-focus layout.
//
// Herdr's own Settings window (app.settings) only has fixed sections: look,
// alerts, updates. It has no API for a mod to add a row, and settings() drops
// keys Herdr does not know when it rewrites settings.json. So this overlay is
// the layout's own settings page. Picks live in shared state (shared.json);
// settings.json keys seed them for a fresh home but they are not the truth.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, layout, shared, setShared, exec, appHome } from "herdr";

const HELPER = "mods/sweg-focus-px0/px0_workspace.py";
const INSTALL = "curl -fsSL https://px0.ai/install.sh | sh";

const MODES = [
  { id: "custom", label: "Files & Git", desc: "Custom panels inside this rail", icon: "mods/files/folder.svg" },
  { id: "px0", label: "px0 window", desc: "Browse, edit and commit in px0", icon: "mods/sweg-pane/code.svg" },
];
const WINDOWS = [
  { id: "browser", label: "Browser tab", desc: "System browser, with its chrome", icon: "mods/workspace-chrome/monitor.svg" },
  { id: "app", label: "App window", desc: "Chrome window without browser chrome", icon: "mods/workspace-chrome/square.svg" },
];
const DOCKS = [
  { id: "left", label: "Left", desc: "Beside the sidebar", icon: "mods/workspace-chrome/panel-left.svg" },
  { id: "right", label: "Right", desc: "After the terminal", icon: "mods/workspace-chrome/panel-right.svg" },
];

function mode() {
  return shared("workspace.mode") === "px0" ? "px0" : "custom";
}

function windowStyle() {
  return shared("px0.window") === "app" ? "app" : "browser";
}

function dockSide() {
  const root = layout();
  return root?.children?.[root.children.length - 1]?.id === "workspace" ? "right" : "left";
}

// The px0 view runs the same helper. Check on open so the status is fresh
// whenever this page shows it.
async function readCheck() {
  try {
    const result = await exec("python3", [`${appHome()}/${HELPER}`, "--check"]);
    if (result.code !== 0) return null;
    const line = (result.stdout || "").trim().split("\n").filter(Boolean).pop();
    return line ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}

export default class WorkspaceSettings extends View {
  init(_props, cx) {
    cx.spawn(async (cx) => {
      const status = await readCheck();
      if (!status) return;
      setShared("px0.installed", status.installed === true);
      setShared("px0.path", status.path ?? null);
      setShared("px0.version", status.version ?? null);
      setShared("px0.workbench", status.workbench ?? { running: false, url: null });
      cx.notify();
    });
  }

  pickMode(id) {
    setShared("workspace.mode", id);
    run("sweg-focus-tabs.reload_mode");
  }

  pickWindow(id) {
    setShared("px0.window", id);
  }

  pickDock(side) {
    setShared("workspace.dock", side);
    run("sweg-focus-tabs.reload_dock");
  }

  heading(t, label, hint) {
    return h_flex().flex_none().px(9).pt(8).pb(3).gap(6).items_center()
      .child(div().text_size(9.5).text_color(t.dim).child(label))
      .when(Boolean(hint), el => el.child(div().text_size(9.5).text_color(t.dim).child(hint)));
  }

  row(t, { id, label, desc, icon, descColor }, on, onclick) {
    return h_flex().id(`settings-${id}`).h(44).px(9).gap(10).flex_none().items_center().rounded(7)
      .when(on, el => el.bg(t.selected))
      .hover(s => s.bg(t.hover))
      .on_click(onclick)
      .child(svg(icon).size(14).flex_none().text_color(descColor ?? (on ? t.accent : t.muted)))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().text_size(12).text_color(t.foreground).child(label))
        .child(div().text_size(10).text_color(descColor ?? t.dim).truncate().child(desc)))
      .when(on, el => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.accent)));
  }

  render() {
    const t = theme();
    const activeMode = mode();
    const activeWindow = windowStyle();
    const side = dockSide();
    const missing = shared("px0.installed") === false;
    return v_flex().id("workspace-settings").w_full().min_h(0).p(6).gap(1).bg(t.popover).text_size(12.8)
      .child(h_flex().flex_none().px(9).pt(2).pb(6).items_center().gap(7)
        .child(svg("mods/workspace-chrome/settings.svg").size(14).flex_none().text_color(t.accent))
        .child(div().font_semibold().text_size(12.5).child("Workspace settings"))
        .child(div().flex_1())
        .child(div().text_size(9.5).text_color(t.dim).child("layout-owned")))
      .child(this.heading(t, "WORKSPACE MODE"))
      .children(MODES.map(item => {
        const px0 = item.id === "px0";
        const row = px0 && missing ? { ...item, desc: "Not installed - install px0 first", descColor: t.blocked } : item;
        return this.row(t, row, activeMode === item.id, () => this.pickMode(item.id));
      }))
      .when(missing, el => el.child(h_flex().flex_none().px(9).pb(3).gap(4).items_center()
        .child(div().text_size(9.5).text_color(t.blocked).child("Install px0:"))
        .child(div().text_size(9.5).text_color(t.muted).child(INSTALL))))
      .child(this.heading(t, "PX0 WINDOW"))
      .children(WINDOWS.map(item => this.row(t, item, activeWindow === item.id, () => this.pickWindow(item.id))))
      .child(this.heading(t, "DOCK"))
      .child(h_flex().gap(5).px(3).pb(3)
        .children(DOCKS.map(item => {
          const on = side === item.id;
          return h_flex().id(`settings-dock-${item.id}`).flex_1().h(30).px(8).gap(6).items_center().rounded(7)
            .bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
            .hover(s => s.bg(t.hover))
            .on_click(() => this.pickDock(item.id))
            .child(svg(item.icon).size(13).flex_none().text_color(on ? t.accent : t.muted))
            .child(div().text_size(11.5).child(item.label))
            .when(on, el => el.child(div().flex_1()).child(svg("mods/workspace-chrome/check.svg").size(12).flex_none().text_color(t.accent)));
        })))
      .child(div().mx(7).my(4).h(1).bg(t.border))
      .child(div().px(9).pb(4).text_size(9.5).text_color(t.dim).child("Herdr's own Settings (⌘,) has no custom sections. Saved in Herdr's shared state; settings.json seeds it."));
  }
}
