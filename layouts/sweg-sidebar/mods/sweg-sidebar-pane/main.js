// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "sweg-sidebar-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, settings, nextCommand, exec, focused, spaces, terminals, layout } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// "code_editor" in settings.json picks the tool:
//   "px0" (default): px0 <dir> -port 0 runs in a new pane on the right; its
//                    server opens the browser itself. Close the pane to stop it.
//   "builtin":       opens the sidebar Files panel instead.
//   ["cmd", "$dir"]: any external editor argv; $dir is replaced with the
//                    pane's folder. Launched detached, no pane.
function openEditor(cwd, pane) {
  const ed = settings().code_editor ?? "px0";
  if (ed === "builtin") {
    // sweg has a workspace stack; sweg-sidebar keeps the sidebar panel.
    const workspace = find(layout(), "workspace-body");
    run("layout.select", workspace ? { stack: "workspace-body", child: "ws-files" } : { stack: "panel-body", child: "files" });
    run("layout.show", { id: workspace ? "workspace" : "panel" });
    return;
  }
  if (Array.isArray(ed)) {
    exec("sh", ["-c", 'nohup "$@" >/dev/null 2>&1 &', "editor", ...ed.map((a) => (a === "$dir" ? cwd : a))]).catch(() => {});
    return;
  }
  // A split pane keeps its source pane's cwd, so match the px0 argv instead.
  const term = terminals().find((t) => {
    const a = t.argv ?? [];
    return a.some((x) => x === "px0" || x.endsWith("/px0")) && a.includes(cwd);
  });
  const open = term && panes().find((p) => p.terminal === term.address)?.pane;
  if (open) {
    run("pane.focus", { pane: open });
    return;
  }
  run("pane.split", { direction: "right", pane, argv: ["px0", cwd, "-port", "0"] });
}

function editorCwd(p) {
  return p?.cwd ?? focused()?.cwd ?? spaces().find((s) => s.active)?.folder;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init(_props, cx) {
    this.hovered = false;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        // Every pane header gets the key command; only the focused pane acts.
        if (c === "open_editor" && focused()?.pane === props()?.pane) {
          const cwd = editorCwd(this.me());
          if (cwd) openEditor(cwd, props().pane);
        }
      }
    });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/sweg-sidebar-pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(div()
          .id(`ph-e-${pane}`)
          .p(3)
          .rounded(4)
          .text_color(t.dim)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => {
            cx.stop_propagation();
            const cwd = editorCwd(p);
            if (cwd) openEditor(cwd, pane);
          })
          .child(svg("mods/sweg-sidebar-pane/code.svg").size(14)))
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
