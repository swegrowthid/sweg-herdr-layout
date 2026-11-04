// Example mod for the {{slug}} layout: one panel with a heading, a line of
// text and a button. Replace it with your own content.
//
// It also listens for the "hello" key command. keys.json binds cmd-shift-y to
// "{{slug}}-example.hello", and nextCommand() delivers it to shown copies.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, nextCommand } from "herdr";

export default class Example extends View {
  init(_props, cx) {
    this.clicks = 0;
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command !== "hello") continue;
        this.bump(cx);
      }
    });
  }

  bump(cx) {
    this.clicks += 1;
    cx.notify();
  }

  render() {
    const t = theme();
    return v_flex().id("{{slug}}-example").size_full().p(12).gap(8).bg(t.chrome).text_size(12.5)
      .child(div().font_semibold().child("Hello from {{slug}}"))
      .child(div().text_size(11).text_color(t.muted).child("This panel is the example mod of the {{slug}} layout."))
      .child(h_flex().id("{{slug}}-example-button").h(28).px(9).items_center().rounded(6).bg(t.selected).cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.bump(cx))
        .child(div().text_size(11.5).text_color(t.foreground).child("Click me, or press cmd-shift-y")))
      .child(div().text_size(11).text_color(t.dim).child(`Greetings: ${this.clicks}`));
  }
}
