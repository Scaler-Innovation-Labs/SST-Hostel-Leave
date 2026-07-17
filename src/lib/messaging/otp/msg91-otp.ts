import { withRetry } from "@/lib/messaging/retry";

const MSG91_BASE = "https://api.msg91.com/api/v5";

function getConfig() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey) throw new Error("MSG91_AUTH_KEY is not configured");
  if (!templateId) throw new Error("MSG91_OTP_TEMPLATE_ID is not configured");
  return { authKey, templateId };
}

function normalizeMobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "91" + digits.slice(1);
  if (digits.startsWith("91") && digits.length === 12) return digits;
  return "91" + digits;
}

export async function sendOtpViaMsg91(
  phone: string,
  otp: string,
  vars?: Record<string, string>
): Promise<void> {
  const { authKey, templateId } = getConfig();
  const mobile = normalizeMobile(phone);

  const params = new URLSearchParams({
    authkey: authKey,
    template_id: templateId,
    mobile,
    otp,
    otp_length: String(otp.length),
    otp_expiry: "5",
  });

  if (vars) {
    Object.values(vars).forEach((value, idx) => {
      params.set(`VAR${idx + 1}`, value);
    });
  }

  await withRetry(async () => {
    const res = await fetch(`${MSG91_BASE}/otp?${params.toString()}`, {
      method: "POST",
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.type !== "success") {
      throw new Error(
        `MSG91 OTP send failed: ${body.message ?? res.statusText}`
      );
    }
  });
}

export async function sendApprovalOtpViaMsg91(
  phone: string,
  otp: string,
  vars: {
    studentName: string;
    dates: string;
    reason: string;
    approvalLink: string;
    shortCode: string;
  }
): Promise<void> {
  const templateId = process.env.MSG91_OTP_APPROVAL_TEMPLATE_ID;
  if (!templateId) {
    throw new Error("MSG91_OTP_APPROVAL_TEMPLATE_ID is not configured");
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) throw new Error("MSG91_AUTH_KEY is not configured");

  const mobile = normalizeMobile(phone);

  const params = new URLSearchParams({
    authkey: authKey,
    template_id: templateId,
    mobile,
    otp,
    otp_length: String(otp.length),
    otp_expiry: "5",
    VAR1: vars.studentName,
    VAR2: vars.dates,
    VAR3: vars.reason,
    VAR4: vars.approvalLink,
    VAR5: vars.shortCode,
  });

  await withRetry(async () => {
    const res = await fetch(`${MSG91_BASE}/otp?${params.toString()}`, {
      method: "POST",
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.type !== "success") {
      throw new Error(
        `MSG91 OTP send failed: ${body.message ?? res.statusText}`
      );
    }
  });
}

export async function verifyOtpViaMsg91(
  phone: string,
  otp: string
): Promise<boolean> {
  const { authKey } = getConfig();
  const mobile = normalizeMobile(phone);

  const params = new URLSearchParams({
    authkey: authKey,
    mobile,
    otp,
  });

  const res = await fetch(`${MSG91_BASE}/otp/verify?${params.toString()}`, {
    method: "POST",
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok && body.type === "success") {
    return true;
  }

  return false;
}
