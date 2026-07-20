ALTER TABLE "relays" ADD COLUMN "warmup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "relays" ADD COLUMN "warmup_days" integer;