// HUD bar of the "neon" layout: system, branch, agents by status,
// listening ports (click: lk-ports), clock. On its first render since the app launched, it opens
// the boot screen (neon-boot).
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, exec } from "herdr";

// Executables from macOS or installed apps: their ports aren't dev servers
// (AirPlay, Adobe, Ollama…). Ports ≥ 49152: ephemeral.
const SYSTEM = /^(\/System\/|\/usr\/(libexec|sbin)\/|\/Library\/|\/Applications\/|\/sbin\/)/;

const pad = (n) => String(n).padStart(2, "0");

export default class NeonHud extends View {
  init(_props, cx) {
    this.now = new Date();
    // globalThis survives hot reloads: only once per launch.
    if (!globalThis.__neonBooted) {
      globalThis.__neonBooted = true;
      run("mod.open", { name: "neon-boot" });
    }
    // The clock only changes every minute: a tick every 15 s is enough.
    cx.timer.every(15000, (cx) => { this.now = new Date(); cx.notify(); });
    // TCP ports listening on this machine, re-read every 5 s.
    this.ports = [];
    this.scanPorts(cx);
    cx.timer.every(5000, (cx) => this.scanPorts(cx));
  }

  scanPorts(cx) {
    cx.spawn(async (cx) => {
      let r;
      try { r = await exec("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]); } catch { return; }
      // pid -> ports it listens on
      const byPid = new Map();
      let pid = null;
      for (const line of r.stdout.split("\n")) {
        if (line.startsWith("p")) pid = line.slice(1);
        const m = line.match(/^n.*:(\d+)$/);
        if (m && pid) (byPid.get(pid) ?? byPid.set(pid, new Set()).get(pid)).add(Number(m[1]));
      }
      // Each pid's executable path, to leave out macOS and apps.
      const paths = new Map();
      if (byPid.size) {
        try {
          const ps = await exec("ps", ["-o", "pid=,comm=", "-p", [...byPid.keys()].join(",")]);
          for (const line of ps.stdout.split("\n")) {
            const m = line.trim().match(/^(\d+)\s+(.*)$/);
            if (m) paths.set(m[1], m[2]);
          }
        } catch {}
      }
      const found = new Set();
      for (const [id, ports] of byPid) {
        if (SYSTEM.test(paths.get(id) ?? "")) continue;
        for (const port of ports) if (port < 49152) found.add(port);
      }
      const list = [...found].sort((a, b) => a - b);
      if (list.join() === this.ports.join()) return;
      this.ports = list;
      cx.notify();
    });
  }

  portsSeg(t) {
    const shown = this.ports.slice(0, 4).join("·");
    const more = this.ports.length > 4 ? ` +${this.ports.length - 4}` : "";
    return h_flex().id("hud-ports").gap(6).items_center().px(6).rounded(3).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .tooltip("Listening dev ports (excluding macOS and apps) · click to manage")
      .on_click(() => run("mod.open", { name: "lk-ports" }))
      .child(div().text_color(t.dim).child("PORTS"))
      .child(div().text_color(this.ports.length ? t.ansi11 : t.dim).font_semibold()
        .child(this.ports.length ? shown + more : "—"));
  }

  seg(t, label, value, color) {
    return h_flex().gap(6).items_center()
      .child(div().text_color(t.dim).child(label))
      .child(div().text_color(color ?? t.foreground).font_semibold().child(value));
  }

  sep(t) { return div().w(1).h(12).bg(t.border); }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const list = agents();
    const n = (st) => list.filter((a) => a.status === st).length;
    const working = n("working"), blocked = n("blocked"), done = n("done");
    const d = this.now;
    const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    const host = space?.machine ? space.machine.toUpperCase() : "LOCAL";

    return div().size_full().bg(t.chrome).border_t(1).border_color(t.input)
      .child(h_flex().size_full().px(14).gap(14).items_center().text_size(11).text_color(t.muted)
        .child(h_flex().gap(6).items_center()
          .child(div().size(6).rounded(3).bg(t.accent))
          .child(div().text_color(t.accent).font_semibold().child("SYS//ONLINE")))
        .child(this.sep(t))
        .child(this.seg(t, "NODE", host))
        .when(Boolean(space?.branch), (el) => el.child(this.sep(t)).child(this.seg(t, "BR", space.branch, t.ansi13)))
        .child(this.sep(t))
        .child(this.seg(t, "AGENTS", String(list.length).padStart(2, "0")))
        .when(working > 0, (el) => el.child(this.seg(t, "RUN", String(working), t.working)))
        .when(done > 0, (el) => el.child(this.seg(t, "OK", String(done), t.done)))
        .when(blocked > 0, (el) => el.child(
          div().px(6).rounded(3).bg(t.blocked + "26").text_color(t.blocked).font_semibold()
            .loop("opacity", { from: 0.5, to: 1, period: 900 })
            .child(`▲ ${blocked} ATTENTION`)))
        .child(div().flex_1())
        .child(this.portsSeg(t))
        .child(this.sep(t))
        .child(div().id("hud-palette").px(6).rounded(3).text_color(t.dim)
          .hover((s) => s.text_color(t.accent).bg(t.hover))
          .cursor_pointer()
          .on_click(() => run("app.palette")).child("⌘ CMD"))
        .child(this.sep(t))
        .child(div().text_color(t.dim).child(date))
        .child(div().text_color(t.accent).font_semibold().child(clock)));
  }
}
