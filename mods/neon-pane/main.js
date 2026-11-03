// Pane header of the "neon" layout: [ PROGRAM ] folder · status, buttons on hover.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";

const SPIN = ["◜", "◠", "◝", "◞", "◡", "◟"];

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class NeonPane extends View {
  init() { this.hovered = false; }

  button(t, id, icon, command, args) {
    return div().id(id).p(3).rounded(3).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.accent))
      .on_click((_e, cx) => { cx.stop_propagation(); run(command, args); })
      .child(svg(`mods/pane/${icon}.svg`).size(13));
  }

  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const name = (((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell").toUpperCase();
    const st = p.status;
    const pane = p.pane;
    const hot = p.focused ? t.accent : t.dim;
    const status = {
      working: ["RUNNING", t.working],
      blocked: ["NEEDS YOU", t.blocked],
      done: ["COMPLETE", t.done],
      idle: ["IDLE", t.dim],
    }[st];

    return h_flex().id(`np-${pane}`).size_full().px(10).gap(8).items_center()
      .bg(p.focused ? t.selected + "80" : t.surface)
      .border_b(1).border_color(p.focused ? t.accent + "80" : t.border)
      .text_size(11)
      .on_hover((h, cx) => { this.hovered = h; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .child(div().w(3).h(12).rounded(1).bg(hot))
      .child(div().flex_none().truncate().max_w(240).font_semibold().text_color(p.focused ? t.accent : t.foreground).child(`[ ${name} ]`))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(Boolean(p.branch), (el) => el.child(div().flex_none().text_color(t.ansi13).child(`⎇ ${p.branch}`)))
      .when(Boolean(status), (el) => el.child(
        h_flex().flex_none().gap(5).items_center().px(6).h(16).rounded(3)
          .bg(status[1] + "1f").border(1).border_color(status[1] + "66")
          .text_size(10).font_semibold().text_color(status[1])
          .when(st === "working", (e) => e.child(div().frames(SPIN, 110).child(SPIN[0])))
          .when(st === "blocked", (e) => e.loop("opacity", { from: 0.45, to: 1, period: 800 }))
          .child(status[0])))
      .when(this.hovered, (el) => el
        .child(this.button(t, `np-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `np-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `np-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `np-x-${pane}`, "close", "pane.close", { pane })));
  }
}
