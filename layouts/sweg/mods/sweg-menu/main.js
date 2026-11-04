// Switcher popup for the sweg workspace header.
// props: { active: "ws-files" | "ws-git" | "ws-px0", overlay }
// Picks the workspace mode (custom panels or px0 window), a view for the
// custom mode, the rail's dock side, and opens the layout's own settings.
// The view rows follow the active mode: Files and Git for custom, px0 for px0.
// The pick goes to shared.json because the overlay is torn down right after a
// click, so async file work here never finishes; sweg-tabs applies it.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, run, closeOverlay, openOverlay, theme, layout, shared, setShared } from "herdr";

const VIEWS = [
  { id: "ws-files", mode: "custom", label: "Files", desc: "Browse this folder", icon: "mods/files/folder.svg" },
  { id: "ws-git", mode: "custom", label: "Git", desc: "Changes and commit", icon: "mods/workspace-chrome/git-branch.svg" },
  { id: "ws-px0", mode: "px0", label: "px0", desc: "Editor window for this repo", icon: "mods/sweg-pane/code.svg" },
];
const DOCKS = [
  { id: "left", label: "Left", icon: "mods/workspace-chrome/panel-left.svg" },
  { id: "right", label: "Right", icon: "mods/workspace-chrome/panel-right.svg" },
];

function dockSide() {
  const root = layout();
  return root?.children?.[root.children.length - 1]?.id === "workspace" ? "right" : "left";
}

function mode() {
  return shared("workspace.mode") === "px0" ? "px0" : "custom";
}

export default class WorkspaceMenu extends View {
  choose(item) {
    closeOverlay(props().overlay);
    if (item.mode === "px0") {
      setShared("workspace.mode", "px0");
    } else {
      setShared("workspace.mode", "custom");
      setShared("workspace.custom.view", item.id);
    }
    run("layout.select", { stack: "workspace-body", child: item.id });
    run("layout.show", { id: "workspace" });
    run("sweg-tabs.reload_mode");
  }

  openSettings() {
    closeOverlay(props().overlay);
    openOverlay({ mod: "sweg-settings", kind: "dialog", width: 720, height: 520, props: { section: "workspace" } });
  }

  dock(side) {
    closeOverlay(props().overlay);
    setShared("workspace.dock", side);
    run("sweg-tabs.reload_dock");
  }

  render() {
    const t = theme();
    const active = props()?.active;
    const activeMode = mode();
    const side = dockSide();
    const views = VIEWS.filter((it) => it.mode === activeMode);
    const row = (it) => {
      const on = it.mode === "px0" ? activeMode === "px0" : activeMode === "custom" && active === it.id;
      return h_flex().id(`workspace-menu-${it.id}`).h(42).px(9).gap(10).flex_none().items_center().rounded(7)
        .when(on, el => el.bg(t.selected))
        .hover(s => s.bg(t.hover))
        .on_click(() => this.choose(it))
        .child(svg(it.icon).size(14).flex_none().text_color(on ? t.accent : t.muted))
        .child(v_flex().flex_1().min_w(0).gap(1)
          .child(div().text_size(12).text_color(t.foreground).child(it.label))
          .child(div().text_size(10).text_color(t.dim).child(it.desc)))
        .when(on, el => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.accent)));
    };
    return v_flex().id("workspace-menu").w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .children(views.map(row))
      .child(div().mx(7).my(5).h(1).bg(t.border))
      .child(h_flex().id("workspace-menu-settings").h(38).px(9).gap(10).flex_none().items_center().rounded(7)
        .hover(s => s.bg(t.hover))
        .on_click(() => this.openSettings())
        .child(svg("mods/workspace-chrome/settings.svg").size(14).flex_none().text_color(t.muted))
        .child(v_flex().flex_1().min_w(0).gap(1)
          .child(div().text_size(12).text_color(t.foreground).child("Workspace settings"))
          .child(div().text_size(10).text_color(t.dim).child("Mode, px0 window, dock")))
        .child(svg("mods/workspace-chrome/chevron-right.svg").size(12).flex_none().text_color(t.dim)))
      .child(div().mx(7).my(5).h(1).bg(t.border))
      .child(div().px(9).pb(3).text_size(10).text_color(t.dim).child("Dock"))
      .child(h_flex().gap(5)
        .children(DOCKS.map((d) => {
          const on = side === d.id;
          return h_flex().id(`workspace-dock-${d.id}`).flex_1().h(30).px(8).gap(6).items_center().rounded(7)
            .bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
            .hover(s => s.bg(t.hover))
            .on_click(() => this.dock(d.id))
            .child(svg(d.icon).size(13).flex_none().text_color(on ? t.accent : t.muted))
            .child(div().text_size(11.5).child(d.label))
            .when(on, el => el.child(div().flex_1()).child(svg("mods/workspace-chrome/check.svg").size(12).flex_none().text_color(t.accent)));
        })));
  }
}
