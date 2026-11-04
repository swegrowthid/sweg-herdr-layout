// The workspace card's header and footer for the sweg layout.
// Header: active view title + switcher + hide. Footer: folder, branch, change counts.
// Both copies are the same mod; props.part says which one draws.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { props, run, theme, layout, nextCommand, openOverlay, spaces, panes, exec, window, settings, shared, setShared } from "herdr";

const VIEWS = {
  "ws-files": { label: "Files", icon: "mods/files/folder.svg" },
  "ws-git": { label: "Git", icon: "mods/workspace-chrome/git-branch.svg" },
  "ws-px0": { label: "px0", icon: "mods/sweg-pane/code.svg" },
};
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

function activeView() {
  return find(layout(), "workspace-body")?.active ?? "ws-files";
}

// The rail follows the space's repo, not the focused pane: switching panes or
// tabs inside the space must not move the workspace (Orca's per-worktree explorer).
function place(s) {
  const tabs = new Set((s.tabs ?? []).map(c => c.id));
  return panes().find(p => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

function location() {
  const space = spaces().find(s => s.active);
  return { cwd: space ? place(space) : null, on: space?.machine ?? null };
}

// The menu shows one view row per active mode: two for custom, one for px0.
// Sizes mirror sweg-menu: 42 px view row, 38 px settings row, 30 px dock
// row, 11 px divider (1 px line with 5 px margins), 19 px label (10 px text
// line with 3 px bottom), 10 px padding. Herdr adds a 2 px frame around a
// popup, and 4 px of slack keeps the dock row off the bottom edge.
const MENU = { view: 42, settings: 38, dock: 30, divider: 11, label: 19, padding: 10, frame: 2, slack: 4 };

function menuHeight() {
  const views = shared("workspace.mode") === "px0" ? 1 : 2;
  return MENU.padding + views * MENU.view + MENU.divider * 2 + MENU.settings
    + MENU.label + MENU.dock + MENU.frame + MENU.slack;
}

export default class Panel extends View {
  init(_props, cx) {
    this.data = { cwd: null, branch: null, count: 0, add: 0, del: 0, repo: null, loading: true };
    this.context = null;
    this.busy = false;
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (props()?.part !== "head") continue;
        const child = c === "files" ? "ws-files" : c === "git" ? "ws-git" : c === "px0" ? "ws-px0" : null;
        if (child) {
          setShared("workspace.mode", c === "px0" ? "px0" : "custom");
          if (c !== "px0") setShared("workspace.custom.view", child);
          run("layout.select", { stack: "workspace-body", child });
          run("layout.show", { id: "workspace" });
          run("sweg-tabs.reload_mode");
          cx.notify();
        }
      }
    });
    if (props()?.part !== "head") {
      this.refresh(cx);
      cx.timer.every(5000, (cx) => this.refresh(cx));
    }
  }

  refresh(cx) {
    if (find(layout(), "workspace")?.hidden) return;
    const { cwd, on } = location();
    // A popup or overlay can take focus and leave no pane; keep the last folder.
    if (!cwd) return;
    const next = `${on ?? ""}|${cwd ?? ""}`;
    if (next !== this.context) {
      this.context = next;
      this.data = { cwd, branch: null, count: 0, add: 0, del: 0, repo: null, loading: true };
    }
    if (!cwd || this.busy) return;
    const context = this.context;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const git = (args) => exec("git", [...READ, ...args], { cwd, on });
        const top = await git(["rev-parse", "--show-toplevel"]);
        if (this.context !== context) return;
        if (top.code !== 0) {
          this.data = { cwd, branch: null, count: 0, add: 0, del: 0, repo: false, loading: false };
          return;
        }
        const [branch, status, diff] = await Promise.all([
          git(["rev-parse", "--abbrev-ref", "HEAD"]),
          git(["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"]),
          git(["diff", "HEAD", "--numstat", "-z", "--no-renames"]),
        ]);
        if (this.context !== context) return;
        let stat = diff;
        if (stat.code !== 0) {
          const [cached, work] = await Promise.all([
            git(["diff", "--cached", "--numstat", "-z", "--no-renames"]),
            git(["diff", "--numstat", "-z", "--no-renames"]),
          ]);
          stat = { code: 0, stdout: `${cached.stdout ?? ""}${work.stdout ?? ""}` };
        }
        let add = 0, del = 0;
        for (const entry of (stat.stdout ?? "").split("\0")) {
          if (!entry) continue;
          const [a, d] = entry.split("\t");
          add += Number(a) || 0;
          del += Number(d) || 0;
        }
        this.data = {
          cwd,
          branch: branch.code === 0 ? branch.stdout.trim() || null : null,
          count: (status.stdout ?? "").split("\0").filter(Boolean).length,
          add, del, repo: true, loading: false,
        };
      } catch {
        if (this.context === context) this.data = { cwd, branch: null, count: 0, add: 0, del: 0, repo: false, loading: false };
      } finally {
        this.busy = false;
        cx.notify();
      }
    });
  }

  head(t, active, cx) {
    const view = VIEWS[active] ?? VIEWS["ws-files"];
    const root = layout(), w = window();
    // Dock left with the sidebar hidden makes the rail the first column: leave
    // room for the window buttons, like the tab bar does.
    const first = root?.children?.[0]?.id === "workspace";
    const lights = first && w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom)
      : 10;
    const side = root?.children?.[root.children.length - 1]?.id === "workspace" ? "right" : "left";
    return h_flex().size_full().px(10).pl(lights).items_center().bg(t.chrome).rounded(10).border(1).border_color(t.border)
      .child(h_flex().id("workspace-title").flex_1().min_w(0).h(28).px(6).gap(7).items_center().rounded(6).cursor_pointer()
        .hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          openOverlay({ mod: "sweg-menu", kind: "popup", width: 286, height: menuHeight(), props: { active } });
        })
        .child(svg(view.icon).size(14).flex_none().text_color(t.accent))
        .child(div().flex_none().font_semibold().text_size(12.5).child(view.label))
        .child(svg("mods/workspace-chrome/chevron-down.svg").size(12).flex_none().text_color(t.dim)))
      .child(h_flex().id("workspace-settings").size(22).flex_none().items_center().justify_center().rounded(5).text_color(t.dim)
        .hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("mod.open", { name: "sweg-settings" });
        })
        .child(svg("mods/workspace-chrome/settings.svg").size(13)))
      .child(h_flex().id("workspace-hide").size(22).flex_none().items_center().justify_center().rounded(5).text_color(t.dim)
        .hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("layout.toggle", { id: "workspace" });
        })
        .child(svg(`mods/workspace-chrome/${side === "right" ? "panel-right" : "panel-left"}.svg`).size(14)));
  }

  foot(t) {
    const d = this.data;
    const name = d.cwd ? d.cwd.split("/").pop() : "No folder";
    const changes = d.repo === false ? "No repository" : d.loading ? "…" : d.count === 0 ? "Clean" : `${d.count} change${d.count === 1 ? "" : "s"}`;
    return h_flex().size_full().px(10).gap(8).items_center().bg(t.chrome).rounded(10).border(1).border_color(t.border).text_size(10.5).text_color(t.dim)
      .child(svg("mods/workspace-chrome/folder.svg").size(12).flex_none().text_color(t.dim))
      .child(div().max_w(96).truncate().text_color(t.muted).child(name))
      .when(Boolean(d.branch), el => el.child(h_flex().h(18).px(5).gap(4).items_center().rounded(4).border(1).border_color(t.border).bg(t.raised).text_size(9.5).text_color(t.muted)
        .child(svg("mods/workspace-chrome/git-branch.svg").size(10).flex_none())
        .child(div().max_w(80).truncate().child(d.branch))))
      .child(div().flex_1())
      .child(div().text_size(10.5).text_color(d.count ? t.muted : t.dim).child(changes))
      .when(d.repo !== false && !d.loading && d.add > 0, el => el.child(div().text_size(10.5).text_color(t.ansi2).child(`+${d.add}`)))
      .when(d.repo !== false && !d.loading && d.del > 0, el => el.child(div().text_size(10.5).text_color(t.ansi1).child(`−${d.del}`)));
  }

  render(cx) {
    const t = theme();
    if (props()?.part === "foot") return this.foot(t);
    return this.head(t, activeView(), cx);
  }
}
