"use client";
import type { Editor } from "@tiptap/react";

export function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage?: () => void }) {
  const b = (active: boolean) => `rounded-md px-2 py-1 text-[0.78rem] font-medium ${active ? "bg-ink text-white" : "text-ink-2 hover:bg-paper-2 hover:text-ink"}`;
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Bağlantı (URL)", prev ?? "https://");
    if (url === null) return;
    if (url === "") return editor.chain().focus().extendMarkRange("link").unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  return (
    <div className="sticky top-0 z-10 flex flex-wrap gap-0.5 border-b border-rule bg-paper px-2 py-1.5">
      <button type="button" className={b(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button type="button" className={b(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      <button type="button" className={b(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button type="button" className={b(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button type="button" className={b(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Liste</button>
      <button type="button" className={b(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Liste</button>
      <button type="button" className={b(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Alıntı</button>
      <button type="button" className={b(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Kod</button>
      <button type="button" className={b(editor.isActive("link"))} onClick={setLink}>Bağlantı</button>
      <button type="button" className={b(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}>Ayraç</button>
      {onPickImage && <button type="button" className={b(false)} onClick={onPickImage}>Görsel</button>}
    </div>
  );
}
