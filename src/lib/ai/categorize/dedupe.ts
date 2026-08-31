import { toSlug } from "@/lib/content/slug";

/**
 * Whether a proposed category name is close enough to an existing one to be
 * treated as the same subject; returns the existing slug it clashes with.
 *
 * Kept in its own module, free of `server-only` and the db client, so the guard
 * can be unit-tested without a database.
 *
 * Comparison is on slugs, so casing, Turkish characters and spacing are already
 * normalised. Containment counts as a clash because that is the failure this
 * exists for: a model proposing "Yazılım Geliştirme" when "Yazılım" is right
 * there, one post at a time, until the category list is noise.
 */
export function isNearDuplicate(candidate: string, existing: readonly string[]): string | null {
  const a = toSlug(candidate);
  if (!a) return null;
  for (const e of existing) {
    if (a === e || a.includes(e) || e.includes(a)) return e;
  }
  return null;
}
