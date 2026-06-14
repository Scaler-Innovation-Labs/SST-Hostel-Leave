CREATE TYPE "public"."notification_recipient_type" AS ENUM('STUDENT', 'PARENT', 'CURRENT_APPROVER', 'PREVIOUS_APPROVER', 'ALL_APPROVERS', 'WARDEN', 'POC', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "notification_rule_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	CONSTRAINT "notification_rule_channel_unq" UNIQUE("rule_id","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_rule_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"recipient_type" "notification_recipient_type" NOT NULL,
	CONSTRAINT "notification_rule_recipient_unq" UNIQUE("rule_id","recipient_type")
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_type_id" uuid,
	"event_type" "notification_event" NOT NULL,
	"template_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"custom_recipients" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "use_global_notification_rules" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_rule_channels" ADD CONSTRAINT "notification_rule_channels_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_rules_leave_type_event_idx" ON "notification_rules" USING btree ("leave_type_id","event_type");--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_code_unique" UNIQUE("code");