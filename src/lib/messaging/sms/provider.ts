export enum SmsTemplate {
  PARENT_APPROVAL = "PARENT_APPROVAL",
  LEAVE_APPROVED = "LEAVE_APPROVED",
  LEAVE_REJECTED = "LEAVE_REJECTED",
  LEAVE_SUBMITTED = "LEAVE_SUBMITTED",
  LEAVE_CANCELLED = "LEAVE_CANCELLED",
  LEAVE_EXTENSION_REQUESTED = "LEAVE_EXTENSION_REQUESTED",
  LEAVE_EXTENSION_APPROVED = "LEAVE_EXTENSION_APPROVED",
  LEAVE_EXTENSION_REJECTED = "LEAVE_EXTENSION_REJECTED",
  LEAVE_COMPLETED = "LEAVE_COMPLETED",
  LEAVE_EXPIRED = "LEAVE_EXPIRED",
  LEAVE_OVERDUE = "LEAVE_OVERDUE",
  GATE_PASS = "GATE_PASS",
  LATE_RETURN = "LATE_RETURN",
  EMERGENCY = "EMERGENCY",
  OTP_DELIVERY = "OTP_DELIVERY",
}

export type SmsPayload = {
  to: string
  body: string
  template?: SmsTemplate
  variables?: Record<string, string>
  providerMetadata?: Record<string, unknown>
}

export type SmsResult = {
  success: boolean
  messageId?: string
  error?: string
}

export interface SmsProvider {
  send(payload: SmsPayload): Promise<SmsResult>
}
