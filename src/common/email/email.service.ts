import { Injectable } from '@nestjs/common';
import { BrevoClient } from '@getbrevo/brevo';
import { EmailRecipient } from './types';
import { SendTransacEmailResponse } from 'node_modules/@getbrevo/brevo/dist/cjs/api';

@Injectable()
export class EmailService {
  private brevoClient: BrevoClient;

  constructor() {
    this.brevoClient = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY || 'your_brevo_api_key',
      timeoutInSeconds: 30,
      maxRetries: 3,
    });
  }

  private async sendEmail(
    arrRecipients: EmailRecipient[],
    subject: string,
    htmlContent: string,
  ): Promise<SendTransacEmailResponse> {
    try {
      const response: SendTransacEmailResponse =
        await this.brevoClient.transactionalEmails.sendTransacEmail({
          sender: {
            name: 'Mu Campana Web',
            email: 'no-reply-devhans@outlook.com',
          },
          to: arrRecipients,
          subject: subject,
          htmlContent: htmlContent,
          textContent: htmlContent.replace(/<[^>]+>/g, ''), // Remove HTML tags for plain text version
        });

      return response;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendWelcomeWithPasswordEmail(
    recipient: EmailRecipient,
    password: string,
  ): Promise<SendTransacEmailResponse> {
    const subject = 'Bienvenido a Mu Campana';
    const htmlContent = `
      <h1>¡Bienvenido a Mu Campana!</h1>
      <p>Tu cuenta ha sido creada exitosamente.</p>
      <p>Tu contraseña es: <strong>${password}</strong></p>
      <p>¡Disfruta el juego!</p>
    `;
    return this.sendEmail([recipient], subject, htmlContent);
  }
}
