export type NotificationPayload = {
	to: string;
	subject?: string;
	body: string;
	metadata?: Record<string, unknown>;
};

export type NotificationSendResult = {
	success: boolean;
	messageId?: string;
	error?: string;
};

export type NotificationProvider = {
	send(payload: NotificationPayload): Promise<NotificationSendResult>;
}
