ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_role_id_pk";--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "scope_type" text;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "scope_id" uuid;--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_scope_unq" ON "user_roles" USING btree ("user_id","role_id","scope_type","scope_id");