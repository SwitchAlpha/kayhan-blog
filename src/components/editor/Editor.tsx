"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { contentExtensions } from "@/lib/content/extensions";
import { SlashCommands } from "./slash";
import { Toolbar } from "./Toolbar";
import { uploadImage } from "./upload";

export function Editor({ value, onChange }: { value: JSONContent; onChange: (doc: JSONContent) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...contentExtensions, Placeholder.configure({ placeholder: "Yazmaya başla… (/ ile komutlar)" }), SlashCommands],
    content: value,
    editorProps: {
      attributes: { class: "prose-kb min-h-[55vh] focus:outline-none" },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  /**
   * Adopt a document replaced from outside (the AI "enhance" proposal).
   *
   * The editor is otherwise uncontrolled: `content` applies once, so without
   * this the parent's state and what is on screen silently diverge. The
   * equality check is what keeps it uncontrolled for typing — every keystroke
   * flows out through onChange and comes back as a new `value`, and setting it
   * again would move the caret to the end on every character.
   */
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { const h = () => fileInput.current?.click(); document.addEventListener("kb:pick-image", h); return () => document.removeEventListener("kb:pick-image", h); }, []);

  async function insertImages(files: File[]) {
    for (const file of files) {
      try {
        const m = await uploadImage(file);
        const alt = window.prompt("Görsel için alt metin (SEO ve erişilebilirlik için zorunlu)", "") ?? "";
        editor?.chain().focus().setImage({ src: m.src, alt, title: undefined }).updateAttributes("image", { width: m.width, height: m.height, mediaId: m.id }).run();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Yükleme başarısız");
      }
    }
  }

  if (!editor) return <div className="min-h-[55vh] animate-pulse rounded-lg bg-paper-2" />;
  return (
    <div className="card overflow-hidden p-0">
      <Toolbar editor={editor} onPickImage={() => fileInput.current?.click()} />
      <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void insertImages(files); }} />
      <div className="px-6 py-5"><EditorContent editor={editor} /></div>
    </div>
  );
}
