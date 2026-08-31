/** Central cache tag names. Keep in sync with revalidation calls. */
export const tags = {
  post: (id: string) => `post:${id}`,
  posts: (locale: string) => `posts:${locale}`,
  category: (id: string) => `category:${id}`,
  tag: (id: string) => `tag:${id}`,
  page: (key: string) => `page:${key}`,
  redirects: "redirects",
  settings: "settings",
  sitemap: "sitemap",
  feed: (locale: string) => `feed:${locale}`,
} as const;
