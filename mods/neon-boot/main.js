// Boot screen of the neon layout: a diagnostic sequence using the app's real
// numbers, then it closes by itself. Click or Esc to skip.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, terminals, machines, theme, props, closeOverlay, window } from "herdr";

const TICK = 160;     // ms between two lines
const HOLD = 900;     // ms on "SYSTEM READY" before closing

export default class NeonBoot extends View {
  init(_props, cx) {
    this.step = 0;
    this.lines = this.diagnostics();
    this.timer = cx.timer.every(TICK, (cx) => {
      this.step += 1;
      if (this.step > this.lines.length) {
        this.timer.cancel();
        cx.timer.after(HOLD, () => this.close());
      }
      cx.notify();
    });
  }

  diagnostics() {
    const sp = spaces();
    const tabs = sp.reduce((n, s) => n + (s.tabs?.length ?? 0), 0);
    const ag = agents();
    const active = ag.filter((a) => a.status === "working").length;
    const waiting = ag.filter((a) => a.status === "blocked").length;
    const remote = machines().filter((m) => m.name).length;
    const os = { macos: "macOS", linux: "Linux", windows: "Windows" }[window()?.platform] ?? "?";
    return [
      ["OK", `herdr-core kernel online · ${os}`],
      ["OK", `Nodes: local${remote ? ` + ${remote} remote` : ""}`],
      ["OK", `${sp.length} space${sp.length === 1 ? "" : "s"} · ${tabs} tab${tabs === 1 ? "" : "s"} restored`],
      ["OK", `${terminals().length} terminal${terminals().length === 1 ? "" : "s"} attached`],
      [waiting ? "!!" : "OK", `${ag.length} agent${ag.length === 1 ? "" : "s"} detected · ${active} active${waiting ? ` · ${waiting} waiting` : ""}`],
      ["OK", "neon-grid interface loaded"],
    ];
  }

  close() { const id = props()?.overlay; if (id) closeOverlay(id); }

  render() {
    const t = theme();
    const shown = Math.min(this.step, this.lines.length);
    const ready = this.step > this.lines.length;
    const pct = Math.round((shown / this.lines.length) * 100);
    const BAR = 32;
    const filled = Math.round((shown / this.lines.length) * BAR);

    return v_flex().id("boot").w(620).p(28).gap(18)
      .bg(t.canvas).border(1).border_color(t.accent + "99").rounded(4)
      .font_family("JetBrains Mono").text_size(12).text_color(t.muted)
      .on_click(() => this.close())
      .child(v_flex().gap(4)
        .child(h_flex().gap(12).items_center()
          .child(div().w(4).h(30).bg(t.accent))
          .child(div().text_size(30).font_bold().text_color(t.accent).child("N E O N"))
          .child(div().text_size(30).text_color(t.dim).child("//"))
          .child(div().text_size(30).font_bold().text_color(t.foreground).child("H E R D R")))
        .child(div().pl(16).text_size(10.5).text_color(t.dim).child("TERMINAL OPERATIONS INTERFACE · v1")))
      .child(v_flex().gap(4).h(6 * 20).children(this.lines.slice(0, shown).map(([st, text]) =>
        h_flex().gap(10)
          .child(div().text_color(st === "OK" ? t.done : t.blocked).font_semibold().child(`[ ${st} ]`))
          .child(div().text_color(t.foreground).child(text)))))
      .child(h_flex().gap(10).items_center()
        .child(div().text_color(t.accent).child(`[${"█".repeat(filled)}${"░".repeat(BAR - filled)}]`))
        .child(div().w(40).text_color(t.foreground).child(`${pct}%`)))
      .child(h_flex().justify_between()
        .child(ready
          ? div().text_color(t.accent).font_semibold().child("▶ SYSTEM READY")
          : div().text_color(t.dim).frames(["initializing", "initializing.", "initializing..", "initializing..."], 250).child("initializing"))
        .child(div().text_size(10).text_color(t.dim).child("click or Esc to skip")));
  }
}
