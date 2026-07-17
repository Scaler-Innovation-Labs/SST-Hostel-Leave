export enum EmailTemplate {
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
  PARENT_APPROVAL_REQUESTED = "PARENT_APPROVAL_REQUESTED",
}

export type EmailPayload = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: EmailTemplate
  variables?: Record<string, string>
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  from?: string
}

export type EmailResult = {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<EmailResult>
}
