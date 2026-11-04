// px0 workspace view for the sweg-focus layout.
//
// Herdr 0.1.12 has no browser pane, so "px0 workspace" is an editor window
// outside Herdr. This view opens it at the active space's repo: the helper
// starts or reuses the px0 workbench, pre-warms the child workspace, and
// prints the deep-link URL. The mod then opens that URL with `open`.
//
// The old terminal-split path stays as a fallback for machines where the
// workbench deep link fails. When px0 is not installed, the view shows a
// setup card with the install command instead of the launcher.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, spaces, panes, terminals, run, theme, home, exec, readTextFile, watchFolder, shared, setShared, appHome, layout, notify } from "herdr";

const HELPER = "mods/sweg-focus-px0/px0_workspace.py";
const INSTALL = "curl -fsSL https://px0.ai/install.sh | sh";

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

async function readWorkbench() {
  const path = `${home()}/.px0/workbench.lock`;
  try {
    const raw = await readTextFile(path);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.url ? { url: String(data.url).replace(/\/$/, ""), pid: data.pid ?? null } : null;
  } catch {
    return null;
  }
}

// The helper owns install detection: PATH, ~/.local/bin/px0, the version, and
// the workbench lock plus ping, all in one call.
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

// "px0 0.1.20 (darwin/arm64)" reads better as "px0 0.1.20" in the rail.
function versionLabel(status) {
  const raw = (status?.version ?? "").replace(/\s*\(.*\)\s*$/, "").trim();
  if (!raw) return "px0";
  return /^px0\b/.test(raw) ? raw : `px0 ${raw}`;
}

export default class Px0 extends View {
  init(_props, cx) {
    this.workbench = null;
    this.status = null;
    this.busy = false;
    this.checking = false;
    this.note = null;
    this.error = null;
    this.opened = null;
    this.refresh(cx);
    this.check(cx);
    // The lock is the only local truth for "workbench is up". Watch it so the
    // view follows an external start/stop, and keep a slow fallback for the
    // case where the folder does not exist yet.
    cx.spawn(async (cx) => {
      for (;;) {
        try {
          await watchFolder(`${home()}/.px0`);
        } catch {
          return;
        }
        await this.refresh(cx);
      }
    });
    cx.timer.every(15000, (cx) => {
      if (layout() && findActive() === "ws-px0") this.refresh(cx);
    });
  }

  async refresh(cx) {
    this.workbench = await readWorkbench();
    cx.notify();
  }

  applyStatus(status) {
    this.status = status;
    setShared("px0.installed", status.installed === true);
    setShared("px0.path", status.path ?? null);
    setShared("px0.version", status.version ?? null);
    setShared("px0.workbench", status.workbench ?? { running: false, url: null });
  }

  hint(cx, text) {
    this.note = text;
    this.error = null;
    cx.notify();
  }

  check(cx, announce = false) {
    if (this.checking) return;
    this.checking = true;
    cx.notify();
    cx.spawn(async (cx) => {
      const status = await readCheck();
      this.checking = false;
      if (status) this.applyStatus(status);
      cx.notify();
      if (!announce) return;
      if (!status) notify({ title: "px0 check failed", body: "The px0 helper did not answer.", level: "error" });
      else if (status.installed) notify({ title: "px0 found", body: `${versionLabel(status)} is ready.`, level: "success" });
      else notify({ title: "px0 is not installed", body: "Install it in a terminal: " + INSTALL, level: "warning" });
    });
  }

  openWorkspace(cx) {
    const { cwd } = location();
    if (!cwd || this.busy) return;
    if (this.status?.installed === false) {
      this.note = "Install px0 first, then press Check again.";
      cx.notify();
      return;
    }
    this.busy = true;
    this.error = null;
    this.note = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const helper = `${appHome()}/${HELPER}`;
        const runResult = await exec("python3", [helper, cwd]);
        if (runResult.code !== 0) throw new Error((runResult.stderr || runResult.stdout || "px0 helper failed").trim());
        const url = (runResult.stdout || "").trim().split("\n").filter(Boolean).pop();
        if (!url) throw new Error("px0 helper printed no URL");
        const app = shared("px0.window") === "app";
        let opened = app ? await exec("open", ["-na", "Google Chrome", "--args", "--app=" + url]).catch(() => null) : null;
        if (!opened || opened.code !== 0) opened = await exec("open", [url]);
        if (opened.code !== 0) throw new Error((opened.stderr || "Could not open the px0 URL").trim());
        this.note = app && opened ? "Opened in a Chrome app window." : "Opened in the default browser.";
        this.opened = url;
      } catch (error) {
        this.error = String(error);
      } finally {
        this.busy = false;
        cx.notify();
        this.refresh(cx);
      }
    });
  }

  split(cx) {
    const { cwd } = location();
    const pane = focused()?.pane ?? panes()[0]?.pane;
    if (!cwd || !pane) return;
    run("pane.split", { direction: "right", pane, argv: ["px0", cwd, "-port", "0"] });
  }

  setupCard(t) {
    return v_flex().id("px0-setup").flex_none().p(11).gap(8).rounded(9).bg(t.background).border_1().border_color(t.blocked)
      .child(h_flex().gap(7).items_center()
        .child(svg("mods/workspace-chrome/terminal.svg").size(14).flex_none().text_color(t.blocked))
        .child(div().text_size(12.5).font_semibold().text_color(t.foreground).child("px0 is not installed")))
      .child(div().text_size(10.5).text_color(t.muted).child("This view opens your repo in the px0 workbench. Install px0 to enable it."))
      .child(div().text_size(10).text_color(t.foreground).bg(t.raised).border_1().border_color(t.border).rounded(6).px(8).py(6).child(INSTALL))
      .child(div().text_size(9.5).text_color(t.dim).child("Run it in a terminal, then press Check again."))
      .child(h_flex().flex_none().gap(7)
        .child(div().id("px0-check").h(28).px(10).flex().items_center().justify_center().gap(5).rounded(7).bg(t.accent).text_color(t.accent_foreground).text_size(11).font_semibold()
          .when(!this.checking, el => el.cursor_pointer().on_click((_e, cx) => this.check(cx, true)))
          .child(svg("mods/workspace-chrome/circle-check.svg").size(12).flex_none())
          .child(this.checking ? "Checking…" : "Check again")));
  }

  render() {
    const t = theme();
    const { cwd, space } = location();
    const list = sessions();
    const workbench = this.workbench;
    const running = Boolean(workbench);
    const app = shared("px0.window") === "app";
    const branch = space?.branch ?? null;
    const name = cwd ? basename(cwd) : "No folder";
    const path = cwd ? tilde(cwd) : "Focus a terminal first";
    const installed = this.status ? this.status.installed === true : shared("px0.installed") !== false;
    const statusLine = installed && this.status
      ? `${versionLabel(this.status)} · ${running ? workbench.url.replace(/^https?:\/\//, "") : "workbench idle"}`
      : null;
    const canOpen = installed && Boolean(cwd) && !this.busy;
    return v_flex().id("px0").size_full().min_h(0).p(13).gap(10).bg(t.chrome).border_l(1).border_r(1).border_color(t.border).text_color(t.foreground)
      .child(h_flex().flex_none().gap(7).items_center().text_size(10.5).text_color(t.dim)
        .child(div().size(6).rounded(3).bg(installed ? (running ? t.ansi2 : t.dim) : t.blocked))
        .child(div().text_color(t.muted).child(installed ? (running ? "Workbench running" : "Workbench idle") : "px0 not installed"))
        .child(div().child("·"))
        .child(div().child(installed ? (workbench ? workbench.url.replace(/^https?:\/\//, "") : "opens on demand") : "install to enable"))
        .child(div().flex_1())
        .child(div().child(app ? "app window" : "browser tab")))
      .when(!installed, el => el.child(this.setupCard(t)))
      .child(h_flex().flex_none().p(11).gap(10).items_start().rounded(9).bg(t.background).border_1().border_color(t.border)
        .child(div().size(34).flex_none().rounded(8).bg(t.raised).border_1().border_color(t.border).flex().items_center().justify_center()
          .child(svg("mods/sweg-pane/code.svg").size(16).text_color(t.accent)))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(div().text_size(12.5).font_semibold().truncate().child(name))
          .child(div().text_size(10).text_color(t.dim).truncate().child(path))
          .child(h_flex().gap(7).text_size(9.5).text_color(t.muted)
            .when(Boolean(branch), el => el.child(h_flex().gap(4).items_center()
              .child(svg("mods/workspace-chrome/git-branch.svg").size(10).flex_none())
              .child(div().max_w(90).truncate().child(branch)))))))
      .child(h_flex().flex_none().gap(7)
        .child(div().id("px0-open").flex_1().h(33).flex().items_center().justify_center().gap(6).rounded(8)
          .bg(canOpen ? t.accent : t.raised).text_color(canOpen ? t.accent_foreground : t.dim).text_size(11.5).font_semibold()
          .when(canOpen, el => el.cursor_pointer().on_click((_e, cx) => this.openWorkspace(cx)))
          .when(!installed, el => el.cursor_pointer().on_click((_e, cx) => this.hint(cx, "Install px0 first, then press Check again.")))
          .child(svg("mods/sweg-pane/code.svg").size(13).flex_none())
          .child(this.busy ? "Opening…" : "Open workspace"))
        .child(div().id("px0-split").h(33).px(10).flex().items_center().gap(6).rounded(8).border_1().border_color(t.border).bg(t.raised).text_size(11).text_color(installed ? t.muted : t.dim)
          .when(installed && Boolean(cwd), el => el.cursor_pointer().hover(s => s.bg(t.hover)))
          .when(installed, el => el.on_click((_e, cx) => this.split(cx)))
          .when(!installed, el => el.cursor_pointer().on_click((_e, cx) => this.hint(cx, "Split needs px0 installed. Run the install command first.")))
          .child(svg("mods/sweg-pane/split-right.svg").size(13).flex_none().text_color(t.dim))
          .child("Split")))
      .when(Boolean(statusLine), el => el.child(div().flex_none().text_size(9.5).text_color(t.dim).truncate().child(statusLine)))
      .when(Boolean(this.error), el => el.child(div().flex_none().text_size(10.5).text_color(t.ansi1).child(this.error)))
      .when(Boolean(this.note), el => el.child(div().flex_none().text_size(10.5).text_color(t.muted).child(this.note)))
      .when(Boolean(this.opened), el => el.child(div().flex_none().text_size(9.5).text_color(t.dim).truncate().child(this.opened)))
      .child(div().flex_none().text_size(9.5).text_color(t.dim).child("TERMINAL SESSIONS"))
      .children(list.map(s => h_flex().id(`px0-session-${s.address}`).h(34).px(8).gap(7).items_center().rounded(7)
        .bg(s.dir === cwd ? t.selected : t.background).border_1().border_color(t.border)
        .when(Boolean(s.pane), el => el.cursor_pointer().hover(h => h.bg(t.hover)).on_click(() => run("pane.focus", { pane: s.pane })))
        .child(svg("mods/sweg-pane/code.svg").size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(10.5).child(s.dir ? basename(s.dir) : "px0"))
        .child(div().text_size(9.5).text_color(t.dim).child(s.port === "0" ? "auto" : s.port ? `:${s.port}` : "running"))))
      .when(!list.length, el => el.child(v_flex().flex_none().p(12).gap(4).rounded(8).border_1().border_color(t.border).bg(t.background)
        .child(div().text_size(10.5).text_color(t.muted).child("No terminal px0 session. Open workspace uses the px0 workbench."))
        .child(div().text_size(9.5).text_color(t.dim).child("Split starts the old terminal + browser fallback."))))
      .child(div().flex_1())
      .child(v_flex().flex_none().gap(3).text_size(9.5).text_color(t.dim)
        .child(div().child("⌘⇧E opens the focused pane's folder."))
        .child(div().child("Workspace mode, window style and dock: ⌘⇧, or the gear."))
        .child(div().child("Herdr 0.1.12 has no browser pane; px0 stays outside.")));
  }
}

function findActive() {
  const walk = (node) => {
    if (!node) return null;
    if (node.id === "workspace-body") return node.active ?? null;
    for (const child of node.children ?? []) {
      const found = walk(child);
      if (found !== undefined && found !== null) return found;
    }
    return null;
  };
  return walk(layout());
}
