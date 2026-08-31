import { codeToHtml } from "shiki";

/** Highlight at derive time; runs on Node only (never in the Edge runtime). */
export async function highlight(code: string, lang: string | null): Promise<string> {
  const language = lang && lang.trim() ? lang.trim().toLowerCase() : "text";
  try {
    return await codeToHtml(code, {
      lang: language,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
  } catch {
    return await codeToHtml(code, { lang: "text", themes: { light: "github-light", dark: "github-dark" }, defaultColor: false });
  }
}
