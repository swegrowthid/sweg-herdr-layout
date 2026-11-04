// SWEG layout settings. Herdr's own Settings window has fixed sections and no
// API for a mod to add rows, so this overlay is the layout's settings page.
// Picks live in shared state (shared.json); settings.json keys seed a fresh
// home but they are not the truth.
//
// The View tab is the layout preset picker: Agent, Editor, Review, Zen. The
// preset itself is applied by sweg-tabs, which is always loaded with the
// layout, so the same code serves this page and the cmd-alt-tab key.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, layout, shared, setShared, exec, appHome, props, updates } from "herdr";

const HELPER = "mods/sweg-px0/px0-workspace.py";
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
const VIEWS = [
  { id: "agent", label: "Agent", desc: "Wide agents list, no rail. Best when you steer several agents." },
  { id: "editor", label: "Editor", desc: "Files rail beside the terminal. Best for navigating the repo." },
  { id: "review", label: "Review", desc: "Git rail with the diff. Best when an agent finished a change." },
  { id: "zen", label: "Zen", desc: "Collapsed sidebar, no rail. Best for deep work in one terminal." },
];
const WIDTHS = [
  { id: 360, label: "Compact 360" },
  { id: 420, label: "Default 420" },
  { id: 480, label: "Wide 480" },
];
const LABEL = { agent: "Agent", editor: "Editor", review: "Review", zen: "Zen", custom: "Custom" };

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

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

// The rail's visible state and the sidebar width are enough to name the preset.
// The active stack child separates Editor from Review.
function currentView() {
  const root = layout();
  const ws = find(root, "workspace");
  const sidebar = find(root, "sidebar")?.size?.px ?? 268;
  const body = find(root, "workspace-body")?.active;
  if (ws?.hidden) return sidebar <= 100 ? "zen" : "agent";
  if (body === "ws-git") return "review";
  if (body === "ws-files") return "editor";
  return "custom";
}

function railWidth() {
  return find(layout(), "workspace")?.size?.px ?? 480;
}

function nearestWidth() {
  const now = railWidth();
  return WIDTHS.reduce((a, b) => (Math.abs(b.id - now) < Math.abs(a.id - now) ? b : a)).id;
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
    const asked = props()?.section;
    this.section = ["view", "workspace", "about"].includes(asked) ? asked : "view";
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
    run("sweg-tabs.reload_mode");
  }

  pickWindow(id) {
    setShared("px0.window", id);
  }

  pickDock(side) {
    setShared("workspace.dock", side);
    run("sweg-tabs.reload_dock");
  }

  // The apply lives in sweg-tabs: it is loaded with the layout, so the same
  // command serves this page and the cmd-alt-tab key.
  pickView(id) {
    setShared("workspace.view.pending", id);
    run("sweg-tabs.set_view");
  }

  pickWidth(px) {
    setShared("workspace.rail.width", px);
    run("layout.resize", { id: "workspace", px });
  }

  resetView() {
    this.pickWidth(480);
    this.pickView("editor");
  }

  keycap(t, label) {
    return div().px(5).py(3).rounded(4).border(1).border_color(t.border).bg(t.chrome)
      .text_size(9.5).text_color(t.muted).child(label);
  }

  heading(t, label, hint) {
    return h_flex().flex_none().pt(2).pb(4).gap(6).items_center()
      .child(div().text_size(9.5).text_color(t.dim).child(label))
      .when(Boolean(hint), el => el.child(div().text_size(9.5).text_color(t.dim).child(hint)));
  }

  row(t, { id, label, desc, icon, descColor }, on, onclick) {
    return h_flex().id(`settings-${id}`).h(44).px(8).gap(10).flex_none().items_center().rounded(7)
      .when(on, el => el.bg(t.selected))
      .hover(s => s.bg(t.hover))
      .on_click(onclick)
      .child(svg(icon).size(14).flex_none().text_color(descColor ?? (on ? t.accent : t.muted)))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().text_size(12).text_color(t.foreground).child(label))
        .child(div().text_size(10).text_color(descColor ?? t.dim).truncate().child(desc)))
      .when(on, el => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.accent)));
  }

  infoRow(t, title, desc, control) {
    return h_flex().h(44).px(8).gap(10).flex_none().items_center().rounded(7)
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(div().text_size(12).text_color(t.foreground).child(title))
        .child(div().text_size(10).text_color(t.dim).child(desc)))
      .child(control);
  }

  button(t, id, label, onclick, primary) {
    return h_flex().id(id).h(27).px(10).items_center().rounded(6).cursor_pointer()
      .when(primary, el => el.bg(t.accent).text_color(t.solid_foreground ?? t.foreground))
      .when(!primary, el => el.border(1).border_color(t.border).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)))
      .on_click(onclick)
      .child(label);
  }

  navRow(t, id, icon, label, on, onclick, cx) {
    return h_flex().id(`settings-nav-${id}`).h(32).px(9).gap(9).flex_none().items_center().rounded(7)
      .when(on, el => el.bg(t.selected))
      .hover(s => s.bg(t.hover))
      .on_click(() => { onclick(); cx.notify(); })
      .child(svg(icon).size(13).flex_none().text_color(on ? t.accent : t.muted))
      .child(div().text_size(11.5).text_color(on ? t.foreground : t.muted).child(label));
  }

  // A miniature of the layout, in the theme's colors.
  line(t, color, width) {
    return div().h(4).rounded(2).bg(color).when(Boolean(width), el => el.w(width));
  }

  miniSide(t, width, rows) {
    return v_flex().w(width).h_full().rounded(3).bg(t.chrome).p(3).gap(3)
      .children(rows.map((r, i) => this.line(t, i === 0 ? t.accent : t.raised, r)));
  }

  miniRail(t, rows) {
    return v_flex().w(54).h_full().rounded(3).bg(t.surface).p(4).gap(3)
      .children(rows.map(([color, width]) => this.line(t, color, width)));
  }

  miniTerm(t, rows) {
    return v_flex().flex_1().min_w(0).h_full().rounded(3).bg(t.chrome).p(5).gap(4)
      .children(rows.map(([color, width]) => this.line(t, color, width)));
  }

  mini(t, id) {
    const canvas = t.canvas ?? t.popover;
    const wrap = (children) => h_flex().h(76).p(5).gap(4).rounded(6).bg(canvas).border(1).border_color(t.border).children(children);
    if (id === "agent") {
      return wrap([
        this.miniSide(t, 30, [22, 18, 16, 20, 14]),
        this.miniTerm(t, [[t.accent_2 ?? t.accent, 0], [t.raised, 0], [t.raised, 26], [t.raised, 0]]),
      ]);
    }
    if (id === "zen") {
      return wrap([
        this.miniSide(t, 9, [10, 8]),
        this.miniTerm(t, [[t.accent_2 ?? t.accent, 0], [t.raised, 0], [t.raised, 22], [t.raised, 0], [t.raised, 14]]),
      ]);
    }
    const diff = id === "review";
    const rail = diff
      ? [[t.ansi2, 0], [t.ansi1, 0], [t.ansi2, 0], [t.ansi1, 34], [t.raised, 22]]
      : [[t.raised, 0], [t.raised, 0], [t.raised, 24], [t.raised, 0], [t.raised, 18]];
    return wrap([
      this.miniSide(t, 18, [14, 12, 16, 10]),
      this.miniRail(t, rail),
      this.miniTerm(t, [[t.accent_2 ?? t.accent, 0], [t.raised, 0], [t.raised, 0]]),
    ]);
  }

  card(t, view, on) {
    return v_flex().id(`settings-view-${view.id}`).flex_1().min_w(0).h(154).p(9).gap(7).rounded(9)
      .border(1).border_color(on ? t.accent : t.border).bg(on ? t.selected : t.popover)
      .hover(s => s.bg(t.hover))
      .on_click(() => this.pickView(view.id))
      .child(this.mini(t, view.id))
      .child(h_flex().gap(6).items_center()
        .child(div().text_size(12).font_semibold().text_color(t.foreground).child(view.label))
        .child(div().flex_1())
        .when(on, el => el.child(svg("mods/workspace-chrome/check.svg").size(13).flex_none().text_color(t.accent))))
      .child(div().text_size(10).line_height("14px").text_color(t.dim).child(view.desc));
  }

  header(t, title, sub) {
    return h_flex().items_start().gap(10).pb(14)
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(div().text_size(16).font_semibold().text_color(t.foreground).child(title))
        .child(div().text_size(11).text_color(t.muted).child(sub)))
      .child(this.keycap(t, "esc"));
  }

  renderView(t) {
    const active = currentView();
    const width = nearestWidth();
    return v_flex().flex_1().min_h(0).gap(0)
      .child(this.header(t, "View", "Choose how much of the workspace rail you want."))
      .child(v_flex().gap(9)
        .child(h_flex().gap(9).children(VIEWS.slice(0, 2).map(v => this.card(t, v, active === v.id))))
        .child(h_flex().gap(9).children(VIEWS.slice(2).map(v => this.card(t, v, active === v.id)))))
      .child(div().pt(16).pb(7).text_size(9.5).text_color(t.dim).child("RAIL WIDTH"))
      .child(h_flex().gap(2).p(2).rounded(7).border(1).border_color(t.border).bg(t.chrome).children(
        WIDTHS.map(w => h_flex().id(`settings-width-${w.id}`).h(26).px(10).gap(5).items_center().rounded(5)
          .when(width === w.id, el => el.bg(t.raised).text_color(t.foreground))
          .when(width !== w.id, el => el.text_color(t.muted))
          .hover(s => s.bg(t.hover))
          .on_click(() => this.pickWidth(w.id))
          .child(svg("mods/workspace-chrome/panel-left.svg").size(11).flex_none())
          .child(div().text_size(11).child(w.label)))))
      .child(div().flex_1())
      .child(h_flex().pt(10).border_t(1).border_color(t.border).gap(6).items_center()
        .child(div().text_size(10).text_color(t.dim).child(`Current: ${LABEL[active]}`))
        .child(div().flex_1())
        .child(this.keycap(t, "⌘⌥⇥"))
        .child(div().text_size(10).text_color(t.dim).child("cycles views"))
        .child(div().flex_1())
        .child(div().text_size(10).text_color(t.dim).child("Changes apply immediately")));
  }

  renderWorkspace(t) {
    const activeMode = mode();
    const activeWindow = windowStyle();
    const side = dockSide();
    const missing = shared("px0.installed") === false;
    return v_flex().flex_1().min_h(0).gap(0)
      .child(this.header(t, "Workspace", "What fills the rail, and where it sits."))
      .child(this.heading(t, "WORKSPACE MODE"))
      .children(MODES.map(item => {
        const px0 = item.id === "px0";
        const row = px0 && missing ? { ...item, desc: "Not installed - install px0 first", descColor: t.blocked } : item;
        return this.row(t, row, activeMode === item.id, () => this.pickMode(item.id));
      }))
      .when(missing, el => el.child(h_flex().flex_none().px(8).pb(3).gap(4).items_center()
        .child(div().text_size(9.5).text_color(t.blocked).child("Install px0:"))
        .child(div().text_size(9.5).text_color(t.muted).child(INSTALL))))
      .child(this.heading(t, "PX0 WINDOW"))
      .children(WINDOWS.map(item => this.row(t, item, activeWindow === item.id, () => this.pickWindow(item.id))))
      .child(this.heading(t, "DOCK"))
      .child(h_flex().gap(5).pb(3).children(DOCKS.map(item => {
        const on = side === item.id;
        return h_flex().id(`settings-dock-${item.id}`).flex_1().h(30).px(8).gap(6).items_center().rounded(7)
          .bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
          .hover(s => s.bg(t.hover))
          .on_click(() => this.pickDock(item.id))
          .child(svg(item.icon).size(13).flex_none().text_color(on ? t.accent : t.muted))
          .child(div().text_size(11.5).child(item.label))
          .when(on, el => el.child(div().flex_1()).child(svg("mods/workspace-chrome/check.svg").size(12).flex_none().text_color(t.accent)));
      })))
      .child(div().flex_1())
      .child(div().pt(10).border_t(1).border_color(t.border).text_size(9.5).text_color(t.dim)
        .child("Saved in Herdr's shared state; settings.json seeds a fresh home."));
  }

  renderAbout(t) {
    const u = updates();
    return v_flex().flex_1().min_h(0).gap(0)
      .child(this.header(t, "About", "The SWEG layout and the app it runs in."))
      .child(this.infoRow(t, "SWEG layout", "Terminal-first workspace with an agent sidebar and a Files, Git or px0 rail.",
        div().text_size(10).text_color(t.dim).child("0.1.12")))
      .child(this.infoRow(t, `Herdr ${u.app.version}`, `herdr-core ${u.core.version ?? "unknown"}`,
        this.button(t, "settings-look", "Theme & font", () => { run("app.settings", { section: "look" }); }, false)))
      .child(this.infoRow(t, "View preset", `Current: ${LABEL[currentView()]}`,
        this.button(t, "settings-reset", "Reset", () => this.resetView(), false)))
      .child(div().flex_1())
      .child(div().pt(10).border_t(1).border_color(t.border).text_size(9.5).line_height("15px").text_color(t.dim)
        .child("Herdr's own Settings (⌘,) has fixed sections. This page is layout-owned. Theme, font and sounds stay in Herdr's Look section."));
  }

  render(cx) {
    const t = theme();
    const nav = v_flex().w(156).flex_none().h_full().bg(t.chrome).p(10).gap(2)
      .child(h_flex().gap(8).items_center().px(6).pb(14)
        .child(div().size(20).rounded(6).bg(t.foreground).text_color(t.chrome).flex().items_center().justify_center()
          .font_semibold().text_size(8).child("H"))
        .child(v_flex().gap(1)
          .child(div().text_size(12).font_semibold().text_color(t.foreground).child("SWEG"))
          .child(div().text_size(9).text_color(t.dim).child("layout settings"))))
      .child(this.navRow(t, "view", "mods/workspace-chrome/panel-left.svg", "View", this.section === "view", () => { this.section = "view"; }, cx))
      .child(this.navRow(t, "workspace", "mods/files/folder.svg", "Workspace", this.section === "workspace", () => { this.section = "workspace"; }, cx))
      .child(this.navRow(t, "about", "mods/workspace-chrome/circle-check.svg", "About", this.section === "about", () => { this.section = "about"; }, cx))
      .child(div().flex_1())
      .child(v_flex().gap(1).pt(8).border_t(1).border_color(t.border).px(6)
        .child(div().text_size(9.5).text_color(t.dim).child(`Herdr app ${updates().app.version}`))
        .child(div().text_size(9.5).text_color(t.dim).child("layout-owned")));
    const body = this.section === "workspace" ? this.renderWorkspace(t)
      : this.section === "about" ? this.renderAbout(t)
        : this.renderView(t);
    return h_flex().id("workspace-settings").size_full().bg(t.popover).text_size(12.8)
      .child(nav)
      .child(div().w(1).h_full().bg(t.border))
      .child(v_flex().flex_1().min_w(0).min_h(0).p(18).child(body));
  }
}
