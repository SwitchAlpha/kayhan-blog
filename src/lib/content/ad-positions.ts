/**
 * Split sanitized post HTML at top-level block boundaries for in-article ad units:
 * first unit after ~250 words (never before the first heading/lead), second near the middle for long posts.
 * Never splits inside a block; returns [html] for short posts.
 */
export function splitHtmlForAds(html: string, wordCount: number): string[] {
  if (wordCount < 350) return [html];
  const blocks = html.match(/<(p|h2|h3|h4|ul|ol|blockquote|div class="code-block"[^>]*|figure|pre|hr)[\s\S]*?(<\/\1>|(?<=<hr\s*\/?>))/g);
  if (!blocks || blocks.length < 6) return [html];
  const words = (s: string) => s.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const cuts: number[] = [];
  let acc = 0;
  for (let i = 0; i < blocks.length - 2; i++) {
    acc += words(blocks[i]);
    const isPara = blocks[i].startsWith("<p");
    if (cuts.length === 0 && acc >= 250 && isPara) cuts.push(i + 1);
    else if (cuts.length === 1 && wordCount >= 900 && acc >= wordCount * 0.55 && isPara) { cuts.push(i + 1); break; }
  }
  if (cuts.length === 0) return [html];
  const parts: string[] = [];
  let start = 0;
  for (const c of cuts) { parts.push(blocks.slice(start, c).join("")); start = c; }
  parts.push(blocks.slice(start).join(""));
  return parts;
}
