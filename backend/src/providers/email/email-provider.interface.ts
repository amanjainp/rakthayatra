export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  eventId?: string;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<{ success: boolean; providerId?: string; error?: string }>;
}
