import sanitizeHtml from "sanitize-html";
import { SITE_URL } from "@/lib/site/config";

const allowedTags = [
  "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "br",
  "strong", "em", "s", "u", "a", "img", "figure", "figcaption", "span", "table", "thead", "tbody", "tr", "th", "td",
];

export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      a: ["href", "title", "rel", "target", "data-ai-link"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "data-media-id", "srcset", "sizes"],
      code: ["class"],
      pre: ["class", "data-language"],
      p: ["data-code-slot"],
      span: ["class", "style"], // shiki token colors
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      "*": ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    allowedStyles: { span: { color: [/^#[0-9a-fA-F]{3,8}$/], "font-style": [/^italic$/], "font-weight": [/^(bold|[1-9]00)$/] } },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const internal = href.startsWith("/") || href.startsWith(SITE_URL);
        return { tagName, attribs: internal ? { ...attribs } : { ...attribs, rel: "noopener", target: "_blank" } };
      },
    },
  });
}
