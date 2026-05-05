CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"measured_at" timestamp with time zone,
	"time" time,
	"source" text NOT NULL,
	"source_id" text,
	"weight_kg" real,
	"fat_pct" real,
	"lean_mass_kg" real,
	"muscle_mass_kg" real,
	"skeletal_muscle_pct" real,
	"bone_mass_kg" real,
	"water_pct" real,
	"visceral_fat" real,
	"bmr_kcal" integer,
	"body_age" integer,
	"bmi" real,
	"heart_rate" integer,
	"pwv" real,
	"raw_payload_jsonb" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurements_user_source_sourceid_uniq" ON "body_measurements" USING btree ("user_id","source","source_id");