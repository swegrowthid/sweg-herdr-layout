// Switcher popup for the sweg-focus workspace header.
// props: { active: "ws-files" | "ws-git" | "ws-px0", overlay }
// Also picks the rail's dock side. The pick goes to shared.json because the
// overlay is torn down right after a click, so async file work here never
// finishes; sweg-focus-tabs applies the move and syncs settings.json.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, run, closeOverlay, theme, layout, setShared } from "herdr";

const ITEMS = [
  { id: "ws-files", label: "Files", desc: "Browse this folder", icon: "mods/files/folder.svg" },
  { id: "ws-git", label: "Git", desc: "Changes and commit", icon: "mods/workspace-chrome/git-branch.svg" },
  { id: "ws-px0", label: "px0", desc: "Code navigator", icon: "mods/sweg-pane/code.svg" },
];
const DOCKS = [
  { id: "left", label: "Left", icon: "mods/workspace-chrome/panel-left.svg" },
  { id: "right", label: "Right", icon: "mods/workspace-chrome/panel-right.svg" },
];

function dockSide() {
  const root = layout();
  return root?.children?.[root.children.length - 1]?.id === "workspace" ? "right" : "left";
}

export default class WorkspaceMenu extends View {
  choose(id) {
    closeOverlay(props().overlay);
    run("layout.select", { stack: "workspace-body", child: id });
    run("layout.show", { id: "workspace" });
  }

  dock(side) {
    closeOverlay(props().overlay);
    setShared("workspace.dock", side);
    run("sweg-focus-tabs.reload_dock");
  }

  render() {
    const t = theme();
    const active = props()?.active;
    const side = dockSide();
    return v_flex().id("workspace-menu").w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .children(ITEMS.map((it) => {
        const on = active === it.id;
        return h_flex().id(`workspace-menu-${it.id}`).h(42).px(9).gap(10).items_center().rounded(7)
          .when(on, el => el.bg(t.selected))
          .hover(s => s.bg(t.hover))
          .on_click(() => this.choose(it.id))
          .child(svg(it.icon).size(14).flex_none().text_color(on ? t.accent : t.muted))
          .child(v_flex().flex_1().min_w(0).gap(1)
            .child(div().text_size(12).text_color(t.foreground).child(it.label))
            .child(div().text_size(10).text_color(t.dim).child(it.desc)))
          .when(on, el => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.accent)));
      }))
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
