export interface SMSPayload {
  phone: string;
  body: string;
  eventId?: string;
}

export interface SMSProvider {
  send(payload: SMSPayload): Promise<{ success: boolean; providerId?: string; error?: string }>;
}
