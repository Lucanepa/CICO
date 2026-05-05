CREATE TABLE "ecg_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"date" date NOT NULL,
	"measured_at" timestamp with time zone,
	"device_model" text,
	"afib_classification" text,
	"average_heart_rate" integer,
	"qrs_ms" integer,
	"pr_ms" integer,
	"qt_ms" integer,
	"qtc_ms" integer,
	"duration_sec" integer,
	"sampling_rate_hz" integer,
	"lead_count" integer,
	"signal_url" text,
	"signal_jsonb" jsonb,
	"raw_payload_jsonb" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "systolic_bp" integer;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "diastolic_bp" integer;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "spo2_pct" real;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "vascular_age" integer;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "nerve_health_score" real;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "extracellular_water_kg" real;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD COLUMN "intracellular_water_kg" real;--> statement-breakpoint
ALTER TABLE "ecg_recordings" ADD CONSTRAINT "ecg_recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ecg_recordings_user_source_sourceid_uniq" ON "ecg_recordings" USING btree ("user_id","source","source_id");