CREATE TABLE "daily_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"source" text NOT NULL,
	"bmr_calories" integer,
	"active_calories" integer,
	"total_calories" integer,
	"steps" integer,
	"resting_hr" integer,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kcal_100g" real NOT NULL,
	"p_100g" real,
	"c_100g" real,
	"f_100g" real,
	"fiber_100g" real,
	"micros_jsonb" jsonb,
	"default_serving_g" real
);
--> statement-breakpoint
CREATE TABLE "food_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"time" time,
	"food_id" uuid,
	"food_table" text NOT NULL,
	"quantity_g" real NOT NULL,
	"kcal" integer NOT NULL,
	"p" real,
	"c" real,
	"f" real,
	"source_label" text
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"kcal_100g" real NOT NULL,
	"p_100g" real,
	"c_100g" real,
	"f_100g" real,
	"fiber_100g" real,
	"micros_jsonb" jsonb,
	"default_serving_g" real,
	"barcode" text
);
--> statement-breakpoint
CREATE TABLE "heart_rate_minute_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"minute" timestamp with time zone NOT NULL,
	"avg_bpm" smallint NOT NULL,
	"min_bpm" smallint NOT NULL,
	"max_bpm" smallint NOT NULL,
	"sample_count" integer NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heart_rate_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"bpm" smallint NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"settings_jsonb" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"type" text NOT NULL,
	"duration_min" real NOT NULL,
	"calories" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"zone_minutes_jsonb" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"duplicate_of" uuid,
	"raw_payload_jsonb" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"source" text NOT NULL,
	"total_min" integer,
	"deep_min" integer,
	"rem_min" integer,
	"light_min" integer,
	"efficiency" real,
	"hrv_avg" real,
	"score" integer,
	"raw_payload_jsonb" jsonb
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"source" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"source" text PRIMARY KEY NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"last_run_status" text
);
--> statement-breakpoint
ALTER TABLE "daily_totals" ADD CONSTRAINT "daily_totals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_foods" ADD CONSTRAINT "custom_foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log" ADD CONSTRAINT "food_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heart_rate_minute_aggregates" ADD CONSTRAINT "heart_rate_minute_aggregates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heart_rate_samples" ADD CONSTRAINT "heart_rate_samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_sessions" ADD CONSTRAINT "sleep_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_totals_user_date_source_uniq" ON "daily_totals" USING btree ("user_id","date","source");--> statement-breakpoint
CREATE INDEX "hr_min_user_minute_idx" ON "heart_rate_minute_aggregates" USING btree ("user_id","minute");--> statement-breakpoint
CREATE INDEX "hr_user_ts_idx" ON "heart_rate_samples" USING btree ("user_id","timestamp");