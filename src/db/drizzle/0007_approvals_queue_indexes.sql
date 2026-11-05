CREATE INDEX IF NOT EXISTS "lr_current_step_key_idx" ON "leave_requests" USING btree ("current_step_key");
CREATE INDEX IF NOT EXISTS "lr_hostel_status_step_idx" ON "leave_requests" USING btree ("hostel_id", "status", "current_step_key");
CREATE INDEX IF NOT EXISTS "le_current_step_key_idx" ON "leave_extensions" USING btree ("current_step_key");
CREATE INDEX IF NOT EXISTS "la_decision_request_idx" ON "leave_approvals" USING btree ("decision", "leave_request_id");
CREATE INDEX IF NOT EXISTS "la_decision_extension_idx" ON "leave_approvals" USING btree ("decision", "leave_extension_id");
