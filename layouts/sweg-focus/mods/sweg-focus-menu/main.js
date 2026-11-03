// Switcher popup for the sweg-focus workspace header.
// props: { active: "ws-files" | "ws-git" | "ws-px0", overlay }

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, run, closeOverlay, theme } from "herdr";

const ITEMS = [
  { id: "ws-files", label: "Files", desc: "Browse this folder", icon: "mods/files/folder.svg" },
  { id: "ws-git", label: "Git", desc: "Changes and commit", icon: "mods/workspace-chrome/git-branch.svg" },
  { id: "ws-px0", label: "px0", desc: "Code navigator", icon: "mods/sweg-pane/code.svg" },
];

export default class WorkspaceMenu extends View {
  choose(id) {
    closeOverlay(props().overlay);
    run("layout.select", { stack: "workspace-body", child: id });
    run("layout.show", { id: "workspace" });
  }

  render() {
    const t = theme();
    const active = props()?.active;
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
      }));
  }
}
