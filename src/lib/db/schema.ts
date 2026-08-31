import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  bigint,
} from "drizzle-orm/pg-core";

// ---------- custom types ----------
export const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const now = () => sql`now()`;

// ---------- enums ----------
export const localeEnum = pgEnum("locale", ["tr", "en"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "scheduled", "publishing", "published", "unpublished"]);
export const translationStatusEnum = pgEnum("translation_status", ["none", "ai_draft", "reviewed"]);
export const linkCreatorEnum = pgEnum("link_creator", ["ai", "human"]);
export const suggestionStatusEnum = pgEnum("suggestion_status", ["proposed", "rejected_guard", "applied", "reverted"]);
export const indexnowActionEnum = pgEnum("indexnow_action", ["publish", "update", "delete", "redirect"]);
export const consentChoiceEnum = pgEnum("consent_choice", ["granted", "denied", "partial"]);
export const aiTaskEnum = pgEnum("ai_task", ["embed", "link", "review", "translate", "alt", "summary", "categorize", "enhance"]);

export type Locale = (typeof localeEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];

// ---------- settings / taxonomy ----------
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().default(now()),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slugTr: text("slug_tr").notNull().unique(),
  slugEn: text("slug_en").notNull().unique(),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionTr: text("description_tr"),
  descriptionEn: text("description_en"),
  sort: integer("sort").notNull().default(0),
  createdAt: ts("created_at").notNull().default(now()),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slugTr: text("slug_tr").notNull().unique(),
  slugEn: text("slug_en").unique(),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en"),
  introTr: text("intro_tr"),
  introEn: text("intro_en"),
  createdAt: ts("created_at").notNull().default(now()),
});

// ---------- media ----------
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  sha256: text("sha256").notNull().unique(),
  mime: text("mime").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  originalKey: text("original_key").notNull(),
  /** [{ w: number, key: string, bytes: number }] */
  variants: jsonb("variants").$type<{ w: number; key: string; bytes: number }[]>().notNull(),
  blurDataUrl: text("blur_data_url"),
  altTr: text("alt_tr"),
  altEn: text("alt_en"),
  createdAt: ts("created_at").notNull().default(now()),
  deletedAt: ts("deleted_at"),
});

// ---------- posts ----------
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  coverMediaId: uuid("cover_media_id").references(() => media.id),
  cornerstone: boolean("cornerstone").notNull().default(false),
  createdAt: ts("created_at").notNull().default(now()),
  updatedAt: ts("updated_at").notNull().default(now()),
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

export const postLocales = pgTable(
  "post_locales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    slug: text("slug").notNull(),
    status: postStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    contentJson: jsonb("content_json").notNull().default(sql`'{"type":"doc","content":[]}'::jsonb`),
    contentHtml: text("content_html").notNull().default(""),
    contentMd: text("content_md").notNull().default(""),
    contentPlain: text("content_plain").notNull().default(""),
    toc: jsonb("toc").$type<{ id: string; level: number; text: string }[]>().notNull().default([]),
    wordCount: integer("word_count").notNull().default(0),
    readingTimeSec: integer("reading_time_sec").notNull().default(0),
    contentHash: text("content_hash").notNull().default(""),
    linksVersion: integer("links_version").notNull().default(0),
    translationStatus: translationStatusEnum("translation_status").notNull().default("none"),
    translatedFromHash: text("translated_from_hash"),
    /** denormalized tag names for trigram search; maintained by the app */
    tagNames: text("tag_names").notNull().default(""),
    scheduledAt: ts("scheduled_at"),
    publishedAt: ts("published_at"),
    /** bumped only on substantive content edits; drives lastmod / dateModified */
    contentUpdatedAt: ts("content_updated_at"),
    unpublishedAt: ts("unpublished_at"),
    createdAt: ts("created_at").notNull().default(now()),
    updatedAt: ts("updated_at").notNull().default(now()),
    // Generated search columns (see drizzle/0000_extensions_fts.sql for tr_norm/tsv_fold/tr_fold)
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`CASE WHEN locale = 'en' THEN
            setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
            setweight(to_tsvector('english', coalesce(summary,'')), 'B') ||
            setweight(to_tsvector('english', coalesce(content_plain,'')), 'C')
          ELSE tsv_fold(
            setweight(to_tsvector('turkish', tr_norm(coalesce(title,''))), 'A') ||
            setweight(to_tsvector('turkish', tr_norm(coalesce(summary,''))), 'B') ||
            setweight(to_tsvector('turkish', tr_norm(coalesce(content_plain,''))), 'C'))
          END`,
    ),
    titleFold: text("title_fold").generatedAlwaysAs(sql`tr_fold(coalesce(title,'') || ' ' || coalesce(tag_names,''))`),
  },
  (t) => [
    uniqueIndex("post_locales_post_locale_uq").on(t.postId, t.locale),
    uniqueIndex("post_locales_locale_slug_uq").on(t.locale, t.slug),
    index("post_locales_list_idx").on(t.locale, t.status, t.publishedAt),
    index("post_locales_search_tsv_gin").using("gin", t.searchTsv),
    index("post_locales_title_trgm").using("gin", t.titleFold.op("gin_trgm_ops")),
    check("post_locales_slug_chk", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("post_locales_published_chk", sql`${t.status} <> 'published' OR ${t.publishedAt} IS NOT NULL`),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(), // about | contact | privacy | cookies | disclosure
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull(),
    contentJson: jsonb("content_json").notNull().default(sql`'{"type":"doc","content":[]}'::jsonb`),
    contentHtml: text("content_html").notNull().default(""),
    updatedAt: ts("updated_at").notNull().default(now()),
  },
  (t) => [uniqueIndex("pages_key_locale_uq").on(t.key, t.locale)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull().unique(), // full public path incl. /en
    toPath: text("to_path"),
    statusCode: smallint("status_code").notNull(),
    postLocaleId: uuid("post_locale_id").references(() => postLocales.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().default(now()),
  },
  (t) => [check("redirects_status_chk", sql`${t.statusCode} IN (301, 410)`)],
);

// ---------- AI: embeddings & links ----------
export const postEmbeddings = pgTable(
  "post_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postLocaleId: uuid("post_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // doc | para
    paragraphIndex: integer("paragraph_index").notNull().default(-1),
    paragraphHash: text("paragraph_hash"),
    model: text("model").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: ts("created_at").notNull().default(now()),
  },
  (t) => [
    uniqueIndex("post_embeddings_uq").on(t.postLocaleId, t.kind, t.paragraphIndex),
    index("post_embeddings_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    check("post_embeddings_kind_chk", sql`${t.kind} IN ('doc','para')`),
  ],
);

export const linkRuns = pgTable("link_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceLocaleId: uuid("source_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // forward | reverse
  trigger: text("trigger").notNull(), // publish | update | manual | nightly
  model: text("model"),
  promptVersion: text("prompt_version"),
  effort: text("effort"),
  inputHash: text("input_hash"),
  candidates: jsonb("candidates"),
  rawOutput: jsonb("raw_output"),
  usage: jsonb("usage"),
  status: text("status").notNull().default("running"),
  error: text("error"),
  startedAt: ts("started_at").notNull().default(now()),
  finishedAt: ts("finished_at"),
});

export const linkSuggestions = pgTable(
  "link_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => linkRuns.id, { onDelete: "cascade" }),
    sourceLocaleId: uuid("source_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
    targetLocaleId: uuid("target_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
    paragraphIndex: integer("paragraph_index").notNull(),
    paragraphHash: text("paragraph_hash"),
    anchorText: text("anchor_text").notNull(),
    confidence: real("confidence"),
    rationale: text("rationale"),
    similarity: real("similarity"),
    status: suggestionStatusEnum("status").notNull().default("proposed"),
    guardReason: text("guard_reason"),
    createdAt: ts("created_at").notNull().default(now()),
  },
  (t) => [index("link_suggestions_source_idx").on(t.sourceLocaleId, t.status)],
);

export const appliedLinks = pgTable(
  "applied_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    suggestionId: uuid("suggestion_id").references(() => linkSuggestions.id, { onDelete: "set null" }),
    sourceLocaleId: uuid("source_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
    targetLocaleId: uuid("target_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
    /** stored on the Link mark as `aiLinkId` */
    aiLinkId: uuid("ai_link_id").notNull().unique(),
    anchorText: text("anchor_text").notNull(),
    anchorFold: text("anchor_fold").notNull(),
    paragraphIndex: integer("paragraph_index").notNull(),
    createdBy: linkCreatorEnum("created_by").notNull(),
    appliedAt: ts("applied_at").notNull().default(now()),
    revertedAt: ts("reverted_at"),
    revertedBy: text("reverted_by"),
    revertReason: text("revert_reason"),
  },
  (t) => [
    uniqueIndex("applied_links_active_pair_uq").on(t.sourceLocaleId, t.targetLocaleId).where(sql`${t.revertedAt} IS NULL`),
    index("applied_links_target_active_idx").on(t.targetLocaleId).where(sql`${t.revertedAt} IS NULL`),
  ],
);

export const anchorHistogram = pgView("anchor_histogram", {
  targetLocaleId: uuid("target_locale_id"),
  anchorFold: text("anchor_fold"),
  count: bigint("count", { mode: "number" }),
}).as(
  sql`SELECT target_locale_id, anchor_fold, count(*)::bigint AS count FROM applied_links WHERE reverted_at IS NULL GROUP BY 1, 2`,
);

// ---------- IndexNow ----------
export const indexnowQueue = pgTable("indexnow_queue", {
  url: text("url").primaryKey(),
  action: indexnowActionEnum("action").notNull(),
  notBefore: ts("not_before").notNull().default(now()),
  attempts: integer("attempts").notNull().default(0),
  enqueuedAt: ts("enqueued_at").notNull().default(now()),
  lastError: text("last_error"),
});

export const indexnowSubmissions = pgTable(
  "indexnow_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id").notNull(),
    urls: jsonb("urls").$type<string[]>().notNull(),
    httpStatus: integer("http_status"),
    responseBody: text("response_body"),
    retryAfterAt: ts("retry_after_at"),
    submittedAt: ts("submitted_at").notNull().default(now()),
  },
  (t) => [index("indexnow_submissions_time_idx").on(t.submittedAt)],
);

// ---------- consent / AI accounting / SEO ----------
export const consentLog = pgTable("consent_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  ts: ts("ts").notNull().default(now()),
  consentId: uuid("consent_id").notNull(),
  geoBucket: text("geo_bucket").notNull(),
  country: text("country"),
  choice: consentChoiceEnum("choice").notNull(),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  policyVersion: text("policy_version").notNull(),
  uaFamily: text("ua_family"),
});

export const aiBudget = pgTable("ai_budget", {
  day: date("day", { mode: "string" }).primaryKey(),
  calls: integer("calls").notNull().default(0),
  inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
  maxCalls: integer("max_calls").notNull(),
  maxCostMicros: bigint("max_cost_micros", { mode: "number" }).notNull(),
});

export const aiCalls = pgTable("ai_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  task: aiTaskEnum("task").notNull(),
  model: text("model").notNull(),
  effort: text("effort"),
  postLocaleId: uuid("post_locale_id").references(() => postLocales.id, { onDelete: "set null" }),
  contentHash: text("content_hash"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
  durationMs: integer("duration_ms"),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: ts("created_at").notNull().default(now()),
});

export const aiCache = pgTable(
  "ai_cache",
  {
    task: aiTaskEnum("task").notNull(),
    contentHash: text("content_hash").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    result: jsonb("result").notNull(),
    createdAt: ts("created_at").notNull().default(now()),
  },
  (t) => [primaryKey({ columns: [t.task, t.contentHash, t.model, t.promptVersion] })],
);

export const seoReviews = pgTable(
  "seo_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postLocaleId: uuid("post_locale_id").notNull().references(() => postLocales.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    deterministic: jsonb("deterministic").notNull(),
    llm: jsonb("llm"),
    score: smallint("score"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    createdAt: ts("created_at").notNull().default(now()),
  },
  (t) => [index("seo_reviews_post_idx").on(t.postLocaleId, t.createdAt)],
);

export const urlInspections = pgTable(
  "url_inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    inspectedOn: date("inspected_on", { mode: "string" }).notNull(),
    verdict: text("verdict"),
    coverageState: text("coverage_state"),
    indexingState: text("indexing_state"),
    lastCrawlTime: ts("last_crawl_time"),
    robotsState: text("robots_state"),
    raw: jsonb("raw"),
  },
  (t) => [uniqueIndex("url_inspections_uq").on(t.url, t.inspectedOn)],
);

export const linkReports = pgTable(
  "link_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: date("day", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [uniqueIndex("link_reports_uq").on(t.day, t.kind)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  diff: jsonb("diff"),
  ts: ts("ts").notNull().default(now()),
});
export * from "./auth-schema";

// ---------- relations (query API) ----------

export const postsRelations = relations(posts, ({ one, many }) => ({
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  cover: one(media, { fields: [posts.coverMediaId], references: [media.id] }),
  locales: many(postLocales),
  postTags: many(postTags),
}));
export const postLocalesRelations = relations(postLocales, ({ one }) => ({
  post: one(posts, { fields: [postLocales.postId], references: [posts.id] }),
}));
export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({ posts: many(posts) }));
export const tagsRelations = relations(tags, ({ many }) => ({ postTags: many(postTags) }));
