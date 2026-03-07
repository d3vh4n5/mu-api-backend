export type EmailRecipient = {
  email: string;
  name?: string;
};

export type SuccessBrevoResponse = {
  messageId: string;
};

export type ErrorBrevoResponse = {
  code: number;
  message: string;
  details?: any;
};
