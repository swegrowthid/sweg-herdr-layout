// px0 launcher for the sweg-focus layout.
// Herdr 0.1.12 has no browser pane: px0 runs in a split terminal and opens
// the system browser. This view keeps the folder, live sessions and the way in.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, spaces, panes, terminals, run, theme, home } from "herdr";

// The rail follows the space's repo, not the focused pane (Orca's per-worktree explorer).
function place(s) {
  const tabs = new Set((s.tabs ?? []).map(c => c.id));
  return panes().find(p => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

function location() {
  const space = spaces().find(s => s.active);
  return { cwd: space ? place(space) : null, space };
}

function basename(path) {
  return path ? path.split("/").filter(Boolean).pop() ?? path : "";
}

function tilde(path) {
  const h = home();
  return path === h ? "~" : path?.startsWith(h + "/") ? "~" + path.slice(h.length) : path ?? "";
}

function sessions() {
  return terminals()
    .filter(t => (t.argv ?? []).some(a => a === "px0" || a.endsWith("/px0")))
    .map(t => {
      const a = t.argv ?? [];
      const i = a.findIndex(x => x === "px0" || x.endsWith("/px0"));
      const flag = a[i + 1];
      const dir = flag && !flag.startsWith("-") ? flag : t.cwd;
      const pi = a.indexOf("-port");
      const port = pi >= 0 ? a[pi + 1] : null;
      const pane = panes().find(p => p.terminal === t.address)?.pane ?? null;
      return { dir, port, pane, address: t.address };
    });
}

function openPx0(force) {
  const { cwd } = location();
  const pane = focused()?.pane ?? panes()[0]?.pane;
  if (!cwd || !pane) return;
  if (!force) {
    const open = sessions().find(s => s.dir === cwd && s.pane);
    if (open) { run("pane.focus", { pane: open.pane }); return; }
  }
  run("pane.split", { direction: "right", pane, argv: ["px0", cwd, "-port", "0"] });
}

export default class Px0 extends View {
  init(_props, cx) {
    cx.timer.every(4000, (cx) => cx.notify());
  }

  render() {
    const t = theme();
    const { cwd, space } = location();
    const list = sessions();
    const running = list.length > 0;
    const branch = space?.branch ?? null;
    const name = cwd ? basename(cwd) : "No folder";
    const path = cwd ? tilde(cwd) : "Focus a terminal first";
    return v_flex().id("px0").size_full().min_h(0).p(13).gap(10).bg(t.chrome).border_l(1).border_r(1).border_color(t.border).text_color(t.foreground)
      .child(h_flex().flex_none().gap(7).items_center().text_size(10.5).text_color(t.dim)
        .child(div().size(6).rounded(3).bg(running ? t.ansi2 : t.dim))
        .child(div().text_color(t.muted).child(running ? "Running" : "Idle"))
        .child(div().child("·"))
        .child(div().child("code navigator"))
        .child(div().flex_1())
        .child(div().child(list.length ? `${list.length} session${list.length === 1 ? "" : "s"}` : "no session")))
      .child(h_flex().flex_none().p(11).gap(10).items_start().rounded(9).bg(t.background).border_1().border_color(t.border)
        .child(div().size(34).flex_none().rounded(8).bg(t.raised).border_1().border_color(t.border).flex().items_center().justify_center()
          .child(svg("mods/sweg-pane/code.svg").size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().text_size(12.5).font_semibold().truncate().child(name))
          .child(div().text_size(10).text_color(t.dim).truncate().child(path))
          .child(h_flex().gap(7).text_size(9.5).text_color(t.muted)
            .when(Boolean(branch), el => el.child(h_flex().gap(4).items_center()
              .child(svg("mods/workspace-chrome/git-branch.svg").size(10).flex_none())
              .child(div().max_w(90).truncate().child(branch))))
            .child(div().child(`${list.length} px0`)))))
      .child(h_flex().flex_none().gap(7)
        .child(div().id("px0-open").flex_1().h(33).flex().items_center().justify_center().gap(6).rounded(8)
          .bg(cwd ? t.accent : t.raised).text_color(cwd ? t.accent_foreground : t.dim).text_size(11.5).font_semibold()
          .when(Boolean(cwd), el => el.cursor_pointer().on_click(() => openPx0(false)))
          .child(svg("mods/sweg-pane/code.svg").size(13).flex_none())
          .child("Open px0"))
        .child(div().id("px0-split").h(33).px(10).flex().items_center().gap(6).rounded(8).border_1().border_color(t.border).bg(t.raised).text_size(11).text_color(t.muted)
          .when(Boolean(cwd), el => el.cursor_pointer().hover(s => s.bg(t.hover)))
          .on_click(() => openPx0(true))
          .child(svg("mods/sweg-pane/split-right.svg").size(13).flex_none().text_color(t.dim))
          .child("Split")))
      .child(div().flex_none().text_size(9.5).text_color(t.dim).child("SESSIONS"))
      .children(list.map(s => h_flex().id(`px0-session-${s.address}`).h(34).px(8).gap(7).items_center().rounded(7)
        .bg(s.dir === cwd ? t.selected : t.background).border_1().border_color(t.border)
        .when(Boolean(s.pane), el => el.cursor_pointer().hover(h => h.bg(t.hover)).on_click(() => run("pane.focus", { pane: s.pane })))
        .child(svg("mods/sweg-pane/code.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(10.5).child(s.dir ? basename(s.dir) : "px0"))
        .child(div().text_size(9.5).text_color(t.dim).child(s.port === "0" ? "auto" : s.port ? `:${s.port}` : "running"))))
      .when(!list.length, el => el.child(v_flex().flex_none().p(12).gap(4).rounded(8).border_1().border_color(t.border).bg(t.background)
        .child(div().text_size(10.5).text_color(t.muted).child("No px0 session for this folder."))
        .child(div().text_size(9.5).text_color(t.dim).child("Open the current folder to browse code."))))
      .child(div().flex_1())
      .child(v_flex().flex_none().gap(3).text_size(9.5).text_color(t.dim)
        .child(div().child("⌘⇧E opens the focused pane's folder."))
        .child(div().child("px0 opens in your system browser."))
        .child(div().child("Herdr 0.1.12 has no browser pane.")));
  }
}
