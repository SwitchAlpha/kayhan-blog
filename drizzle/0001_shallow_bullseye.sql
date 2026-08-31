CREATE TYPE "public"."ai_task" AS ENUM('embed', 'link', 'review', 'translate', 'alt', 'summary');--> statement-breakpoint
CREATE TYPE "public"."consent_choice" AS ENUM('granted', 'denied', 'partial');--> statement-breakpoint
CREATE TYPE "public"."indexnow_action" AS ENUM('publish', 'update', 'delete', 'redirect');--> statement-breakpoint
CREATE TYPE "public"."link_creator" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('tr', 'en');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('proposed', 'rejected_guard', 'applied', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('none', 'ai_draft', 'reviewed');--> statement-breakpoint
CREATE TABLE "ai_budget" (
	"day" date PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"max_calls" integer NOT NULL,
	"max_cost_micros" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cache" (
	"task" "ai_task" NOT NULL,
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_cache_task_content_hash_model_prompt_version_pk" PRIMARY KEY("task","content_hash","model","prompt_version")
);
--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" "ai_task" NOT NULL,
	"model" text NOT NULL,
	"effort" text,
	"post_locale_id" uuid,
	"content_hash" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applied_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggestion_id" uuid,
	"source_locale_id" uuid NOT NULL,
	"target_locale_id" uuid NOT NULL,
	"ai_link_id" uuid NOT NULL,
	"anchor_text" text NOT NULL,
	"anchor_fold" text NOT NULL,
	"paragraph_index" integer NOT NULL,
	"created_by" "link_creator" NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reverted_at" timestamp with time zone,
	"reverted_by" text,
	"revert_reason" text,
	CONSTRAINT "applied_links_ai_link_id_unique" UNIQUE("ai_link_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_en" text NOT NULL,
	"description_tr" text,
	"description_en" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_tr_unique" UNIQUE("slug_tr"),
	CONSTRAINT "categories_slug_en_unique" UNIQUE("slug_en")
);
--> statement-breakpoint
CREATE TABLE "consent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_id" uuid NOT NULL,
	"geo_bucket" text NOT NULL,
	"country" text,
	"choice" "consent_choice" NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policy_version" text NOT NULL,
	"ua_family" text
);
--> statement-breakpoint
CREATE TABLE "indexnow_queue" (
	"url" text PRIMARY KEY NOT NULL,
	"action" "indexnow_action" NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "indexnow_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"urls" jsonb NOT NULL,
	"http_status" integer,
	"response_body" text,
	"retry_after_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_locale_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"trigger" text NOT NULL,
	"model" text,
	"prompt_version" text,
	"effort" text,
	"input_hash" text,
	"candidates" jsonb,
	"raw_output" jsonb,
	"usage" jsonb,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "link_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_locale_id" uuid NOT NULL,
	"target_locale_id" uuid NOT NULL,
	"paragraph_index" integer NOT NULL,
	"paragraph_hash" text,
	"anchor_text" text NOT NULL,
	"confidence" real,
	"rationale" text,
	"similarity" real,
	"status" "suggestion_status" DEFAULT 'proposed' NOT NULL,
	"guard_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"original_key" text NOT NULL,
	"variants" jsonb NOT NULL,
	"blur_data_url" text,
	"alt_tr" text,
	"alt_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"content_json" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_locale_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"paragraph_index" integer DEFAULT -1 NOT NULL,
	"paragraph_hash" text,
	"model" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_embeddings_kind_chk" CHECK ("post_embeddings"."kind" IN ('doc','para'))
);
--> statement-breakpoint
CREATE TABLE "post_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"slug" text NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"content_json" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"content_plain" text DEFAULT '' NOT NULL,
	"toc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"reading_time_sec" integer DEFAULT 0 NOT NULL,
	"content_hash" text DEFAULT '' NOT NULL,
	"links_version" integer DEFAULT 0 NOT NULL,
	"translation_status" "translation_status" DEFAULT 'none' NOT NULL,
	"translated_from_hash" text,
	"tag_names" text DEFAULT '' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"unpublished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (CASE WHEN locale = 'en' THEN
            setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
            setweight(to_tsvector('english', coalesce(summary,'')), 'B') ||
            setweight(to_tsvector('english', coalesce(content_plain,'')), 'C')
          ELSE tsv_fold(
            setweight(to_tsvector('turkish', tr_norm(coalesce(title,''))), 'A') ||
            setweight(to_tsvector('turkish', tr_norm(coalesce(summary,''))), 'B') ||
            setweight(to_tsvector('turkish', tr_norm(coalesce(content_plain,''))), 'C'))
          END) STORED,
	"title_fold" text GENERATED ALWAYS AS (tr_fold(coalesce(title,'') || ' ' || coalesce(tag_names,''))) STORED,
	CONSTRAINT "post_locales_slug_chk" CHECK ("post_locales"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "post_locales_published_chk" CHECK ("post_locales"."status" <> 'published' OR "post_locales"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"cover_media_id" uuid,
	"cornerstone" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text,
	"status_code" smallint NOT NULL,
	"post_locale_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path"),
	CONSTRAINT "redirects_status_chk" CHECK ("redirects"."status_code" IN (301, 410))
);
--> statement-breakpoint
CREATE TABLE "seo_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_locale_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"deterministic" jsonb NOT NULL,
	"llm" jsonb,
	"score" smallint,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug_tr" text NOT NULL,
	"slug_en" text,
	"name_tr" text NOT NULL,
	"name_en" text,
	"intro_tr" text,
	"intro_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_tr_unique" UNIQUE("slug_tr"),
	CONSTRAINT "tags_slug_en_unique" UNIQUE("slug_en")
);
--> statement-breakpoint
CREATE TABLE "url_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"inspected_on" date NOT NULL,
	"verdict" text,
	"coverage_state" text,
	"indexing_state" text,
	"last_crawl_time" timestamp with time zone,
	"robots_state" text,
	"raw" jsonb
);
--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_post_locale_id_post_locales_id_fk" FOREIGN KEY ("post_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applied_links" ADD CONSTRAINT "applied_links_suggestion_id_link_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."link_suggestions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applied_links" ADD CONSTRAINT "applied_links_source_locale_id_post_locales_id_fk" FOREIGN KEY ("source_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applied_links" ADD CONSTRAINT "applied_links_target_locale_id_post_locales_id_fk" FOREIGN KEY ("target_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_runs" ADD CONSTRAINT "link_runs_source_locale_id_post_locales_id_fk" FOREIGN KEY ("source_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_run_id_link_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."link_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_source_locale_id_post_locales_id_fk" FOREIGN KEY ("source_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_target_locale_id_post_locales_id_fk" FOREIGN KEY ("target_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_embeddings" ADD CONSTRAINT "post_embeddings_post_locale_id_post_locales_id_fk" FOREIGN KEY ("post_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_locales" ADD CONSTRAINT "post_locales_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_post_locale_id_post_locales_id_fk" FOREIGN KEY ("post_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_reviews" ADD CONSTRAINT "seo_reviews_post_locale_id_post_locales_id_fk" FOREIGN KEY ("post_locale_id") REFERENCES "public"."post_locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applied_links_active_pair_uq" ON "applied_links" USING btree ("source_locale_id","target_locale_id") WHERE "applied_links"."reverted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "applied_links_target_active_idx" ON "applied_links" USING btree ("target_locale_id") WHERE "applied_links"."reverted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "indexnow_submissions_time_idx" ON "indexnow_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "link_reports_uq" ON "link_reports" USING btree ("day","kind");--> statement-breakpoint
CREATE INDEX "link_suggestions_source_idx" ON "link_suggestions" USING btree ("source_locale_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_key_locale_uq" ON "pages" USING btree ("key","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "post_embeddings_uq" ON "post_embeddings" USING btree ("post_locale_id","kind","paragraph_index");--> statement-breakpoint
CREATE INDEX "post_embeddings_hnsw" ON "post_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "post_locales_post_locale_uq" ON "post_locales" USING btree ("post_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "post_locales_locale_slug_uq" ON "post_locales" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "post_locales_list_idx" ON "post_locales" USING btree ("locale","status","published_at");--> statement-breakpoint
CREATE INDEX "post_locales_search_tsv_gin" ON "post_locales" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "post_locales_title_trgm" ON "post_locales" USING gin ("title_fold" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "post_tags_tag_idx" ON "post_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "seo_reviews_post_idx" ON "seo_reviews" USING btree ("post_locale_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "url_inspections_uq" ON "url_inspections" USING btree ("url","inspected_on");--> statement-breakpoint
CREATE VIEW "public"."anchor_histogram" AS (SELECT target_locale_id, anchor_fold, count(*)::bigint AS count FROM applied_links WHERE reverted_at IS NULL GROUP BY 1, 2);