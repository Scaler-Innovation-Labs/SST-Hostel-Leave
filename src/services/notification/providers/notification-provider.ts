export type NotificationPayload = {
	to: string | string[];
	subject?: string;
	body: string;
	metadata?: Record<string, unknown>;
	templateCode?: string;
	providerMetadata?: Record<string, unknown>;
};

export type NotificationSendResult = {
	success: boolean;
	messageId?: string;
	error?: string;
};

export type NotificationProvider = {
	send(payload: NotificationPayload): Promise<NotificationSendResult>;
}
