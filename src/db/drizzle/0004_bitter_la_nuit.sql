CREATE TABLE "parent_otp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"otp_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parent_otp_sessions" ADD CONSTRAINT "parent_otp_sessions_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pos_parent_id_idx" ON "parent_otp_sessions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "pos_phone_idx" ON "parent_otp_sessions" USING btree ("phone");