"use client";

import { useState } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useConfigStatus } from "@/hooks/use-config-status";

type ConfigCardProps = {
  title: string;
  description: string;
  fields: Array<{ label: string; configured: boolean; desc?: string }>;
  onTest?: () => void;
  testLabel?: string;
  testLoading?: boolean;
  testResult?: { success: boolean; message: string } | null;
};

function ConfigCard({ title, description, fields, onTest, testLabel, testLoading, testResult }: ConfigCardProps) {
  const allConfigured = fields.every((f) => f.configured);

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${
      allConfigured ? "border-success/30 bg-surface" : "border-border bg-surface"
    }`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-body-lg font-semibold">{title}</h3>
          <p className="mt-0.5 text-body text-muted">{description}</p>
        </div>
        <span
          className={`shrink-0 rounded-sm px-2.5 py-0.5 text-caption font-medium ${
            allConfigured
              ? "bg-success-light text-success"
              : "bg-warning-light text-warning"
          }`}
        >
          {allConfigured ? "Configured" : "Missing"}
        </span>
      </div>

      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center justify-between gap-4 text-body">
            <span>
              <span className="text-muted">{field.label}</span>
              {field.desc && (
                <span className="mt-0.5 block text-caption text-muted/70">{field.desc}</span>
              )}
            </span>
            <span className={`flex items-center gap-1.5 font-medium ${
              field.configured ? "text-success" : "text-danger"
            }`}>
              {field.configured ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Set
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Not set
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {onTest && allConfigured && (
        <div className="mt-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            disabled={testLoading}
          >
            {testLoading ? "Sending..." : testLabel ?? "Send Test"}
          </Button>

          {testResult && (
            <div
              className={`rounded-lg p-3 text-body ${
                testResult.success
                  ? "bg-success-light text-success"
                  : "bg-danger/10 text-danger"
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  const { status, isLoading, isError, mutate } = useConfigStatus();
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});

  const handleTest = async (channel: "email" | "sms" | "slack", recipient?: string) => {
    if (!recipient && channel !== "slack") {
      const promptLabel = channel === "email" ? "Enter recipient email:" : "Enter recipient phone (E.164 format, e.g. +911234567890):";
      const input = window.prompt(promptLabel);
      if (!input) return;
      recipient = input;
    }

    setTestLoading(channel);
    setTestResults((prev) => ({ ...prev, [channel]: null }));
    try {
      const res = await fetch("/api/v1/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, recipient }),
      });
      const json = await res.json();
      if (json.success && json.data?.success) {
        setTestResults((prev) => ({
          ...prev,
          [channel]: { success: true, message: `${channel === "email" ? "Email" : channel === "sms" ? "SMS" : "Slack"} test sent successfully.${json.data.messageId ? ` (ID: ${json.data.messageId})` : ""}` },
        }));
      } else {
        const errMsg = json.data?.error ?? json.error?.message ?? "Test failed.";
        setTestResults((prev) => ({
          ...prev,
          [channel]: { success: false, message: errMsg },
        }));
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [channel]: { success: false, message: "Network error. Check console for details." },
      }));
    } finally {
      setTestLoading(null);
    }
  };

  if (isLoading) return <LoadingState count={4} />;
  if (isError) return <ErrorState message="Failed to load configuration status" onRetry={() => mutate()} />;
  if (!status) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="System configuration and service status."
      />

      {/* Configuration Status */}
      <section className="grid gap-6 md:grid-cols-2">
        <ConfigCard
          title="Email (Resend)"
          description="Transactional email via Resend."
          fields={[
            { label: "RESEND_API_KEY", configured: status.email.apiKey },
            { label: "RESEND_FROM_EMAIL", configured: status.email.fromEmail },
          ]}
          onTest={() => handleTest("email")}
          testLabel="Send Test Email"
          testLoading={testLoading === "email"}
          testResult={testResults.email ?? null}
        />

        <ConfigCard
          title="SMS (Infobip)"
          description="Transactional SMS via Infobip (India DLT)."
          fields={[
            { label: "INFOBIP_API_KEY", configured: status.sms.apiKey },
            { label: "INFOBIP_SENDER_ID", configured: status.sms.senderId },
          ]}
          onTest={() => handleTest("sms")}
          testLabel="Send Test SMS"
          testLoading={testLoading === "sms"}
          testResult={testResults.sms ?? null}
        />

        <ConfigCard
          title="Slack"
          description="Notifications to a Slack channel."
          fields={[
            { label: "SLACK_BOT_TOKEN", configured: status.slack.botToken },
            { label: "SLACK_CHANNEL_ID", configured: status.slack.channelId },
            { label: "SLACK_POC_CHANNEL_ID", configured: status.slack.pocChannelId, desc: "Channel for POC alerts; falls back to SLACK_CHANNEL_ID when unset" },
          ]}
          onTest={() => handleTest("slack")}
          testLabel="Send Test Slack Message"
          testLoading={testLoading === "slack"}
          testResult={testResults.slack ?? null}
        />
      </section>

      {/* System Configuration */}
      <section>
        <h2 className="mb-4 text-body-lg font-semibold">System</h2>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-3">
            {[
              { label: "NEXT_PUBLIC_BASE_URL", configured: status.system.baseUrl, desc: "Public base URL for links in notifications" },
              { label: "NEXT_PUBLIC_APP_URL", configured: status.system.appUrl, desc: "Application URL for API calls" },
              { label: "AUTH_SECRET", configured: status.system.authSecret, desc: "JWT signing secret for parent authentication" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div>
                  <span className={`font-mono text-body ${item.configured ? "text-ink" : "text-danger"}`}>
                    {item.label}
                  </span>
                  <p className="mt-0.5 text-caption text-muted">{item.desc}</p>
                </div>
                <span className={`shrink-0 rounded-sm px-2.5 py-0.5 text-caption font-medium ${
                  item.configured
                    ? "bg-success-light text-success"
                    : "bg-warning-light text-warning"
                }`}>
                  {item.configured ? "Set" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Reference */}
      <section>
        <h2 className="mb-4 text-body-lg font-semibold">Environment Variables Reference</h2>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted">Variable</th>
                  <th className="pb-2 font-medium text-muted">Required For</th>
                  <th className="pb-2 font-medium text-muted">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {[
                  ["RESEND_API_KEY", "Email", "Resend API key for transactional emails"],
                  ["RESEND_FROM_EMAIL", "Email", "Verified sender email for Resend"],
                  ["INFOBIP_API_KEY", "SMS", "Infobip API key (base64 of username:password)"],
                  ["INFOBIP_SENDER_ID", "SMS", "Sender ID registered in Infobip (e.g. Scaler)"],
                  ["INFOBIP_DLT_CONTENT_TEMPLATE_ID", "SMS", "India DLT content template ID"],
                  ["INFOBIP_DLT_PRINCIPAL_ENTITY_ID", "SMS", "India DLT principal entity ID"],
                  ["SLACK_BOT_TOKEN", "Slack", "Slack app bot token (xoxb-*)"],
                  ["SLACK_CHANNEL_ID", "Slack", "Slack channel ID to post to"],
                  ["NEXT_PUBLIC_BASE_URL", "Notifications", "Public URL for notification links"],
                  ["NEXT_PUBLIC_APP_URL", "API", "Internal URL for API-to-API calls"],
                  ["AUTH_SECRET", "Parent Auth", "JWT secret for parent OTP tokens"],
                  ["DATABASE_URL", "Core", "PostgreSQL connection string"],
                  ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "Auth", "Clerk publishable key"],
                  ["CLERK_SECRET_KEY", "Auth", "Clerk secret key"],
                ].map(([variable, requiredFor, purpose]) => (
                  <tr key={variable}>
                    <td className="py-2 font-mono text-caption">{variable}</td>
                    <td className="py-2 text-muted">{requiredFor}</td>
                    <td className="py-2 text-muted">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
