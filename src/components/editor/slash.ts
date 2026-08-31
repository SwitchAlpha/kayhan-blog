"use client";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

type Item = { title: string; hint: string; run: (editor: Editor, range: Range) => void };

export const SLASH_ITEMS: Item[] = [
  { title: "Başlık 2", hint: "/başlık2", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Başlık 3", hint: "/başlık3", run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: "Madde listesi", hint: "/liste", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Numaralı liste", hint: "/numara", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "Alıntı", hint: "/alıntı", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Kod bloğu", hint: "/kod", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: "Ayraç", hint: "/ayraç", run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { title: "Görsel", hint: "/görsel", run: (e, r) => { e.chain().focus().deleteRange(r).run(); document.dispatchEvent(new CustomEvent("kb:pick-image")); } },
];

function fold(s: string) {
  return s.normalize("NFC").replace(/[İIı]/g, "i").toLocaleLowerCase("tr").replace(/[şğüöç]/g, (c) => ({ ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c] ?? c);
}

/** Minimal slash menu: renders a floating list; keyboard ↑/↓/Enter/Esc. */
export const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    const opts: Omit<SuggestionOptions<Item>, "editor"> = {
      char: "/",
      startOfLine: false,
      items: ({ query }) => SLASH_ITEMS.filter((i) => fold(i.title + " " + i.hint).includes(fold(query))).slice(0, 8),
      command: ({ editor, range, props }) => props.run(editor, range),
      render: () => {
        let el: HTMLDivElement | null = null;
        let items: Item[] = [];
        let selected = 0;
        let cmd: ((item: Item) => void) | null = null;
        const draw = () => {
          if (!el) return;
          el.innerHTML = "";
          items.forEach((it, i) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = `block w-full px-3 py-1.5 text-left text-[0.85rem] ${i === selected ? "bg-ink text-white" : "hover:bg-paper-2"}`;
            row.textContent = it.title;
            row.onmousedown = (ev) => { ev.preventDefault(); cmd?.(it); };
            el!.appendChild(row);
          });
        };
        return {
          onStart: (p) => {
            items = p.items; selected = 0; cmd = p.command;
            el = document.createElement("div");
            el.className = "fixed z-50 min-w-48 rounded-lg border border-rule bg-paper py-1 shadow-xl font-display";
            document.body.appendChild(el);
            const rect = p.clientRect?.();
            if (rect) { el.style.left = `${rect.left}px`; el.style.top = `${rect.bottom + 4}px`; }
            draw();
          },
          onUpdate: (p) => { items = p.items; selected = 0; cmd = p.command; const rect = p.clientRect?.(); if (el && rect) { el.style.left = `${rect.left}px`; el.style.top = `${rect.bottom + 4}px`; } draw(); },
          onKeyDown: ({ event }) => {
            if (event.key === "ArrowDown") { selected = (selected + 1) % Math.max(items.length, 1); draw(); return true; }
            if (event.key === "ArrowUp") { selected = (selected - 1 + items.length) % Math.max(items.length, 1); draw(); return true; }
            if (event.key === "Enter") { const it = items[selected]; if (it) cmd?.(it); return true; }
            if (event.key === "Escape") { el?.remove(); el = null; return true; }
            return false;
          },
          onExit: () => { el?.remove(); el = null; },
        };
      },
    };
    return [Suggestion({ editor: this.editor, ...opts })];
  },
});
