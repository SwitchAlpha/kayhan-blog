import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

/**
 * Shared extension list: used by the admin editor (client) and the static renderer (server).
 * Keep this file free of browser-only code.
 */
export const KbLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** set on links inserted by the automatic internal linker; used for audit/revert */
      aiLinkId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-ai-link"),
        renderHTML: (attrs) => (attrs.aiLinkId ? { "data-ai-link": attrs.aiLinkId } : {}),
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: "https",
  HTMLAttributes: { rel: null, target: null },
});

export const KbImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id"),
        renderHTML: (attrs) => (attrs.mediaId ? { "data-media-id": attrs.mediaId } : {}),
      },
      width: { default: null },
      height: { default: null },
    };
  },
}).configure({ inline: false, allowBase64: false, HTMLAttributes: { loading: "lazy", decoding: "async" } });

export const contentExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: false, // replaced by KbLink
    codeBlock: { HTMLAttributes: { class: "code-block" } },
  }),
  KbLink,
  KbImage,
];
