export type NotificationPayload = {
	to: string | string[];
	subject?: string;
	body: string;
	metadata?: Record<string, unknown>;
	templateCode?: string;
	providerMetadata?: Record<string, unknown>;
	/** Slack ids (user group S... or user U...) to CC via mentions. */
	mentions?: string[];
	/** Email addresses to CC on email deliveries. */
	cc?: string[];
};

export type NotificationSendResult = {
	success: boolean;
	messageId?: string;
	error?: string;
};

export type NotificationProvider = {
	send(payload: NotificationPayload): Promise<NotificationSendResult>;
}
