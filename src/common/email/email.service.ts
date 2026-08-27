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

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] || character,
    );
  }

  async sendWelcomeWithPasswordEmail(
    recipient: EmailRecipient,
    password: string,
  ): Promise<SendTransacEmailResponse> {
    const subject = 'Bienvenido a Mu Campana';
    const displayName = this.escapeHtml(recipient.name || 'guerrero');
    const htmlContent = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenido a Mu Campana</title>
        </head>
        <body style="margin:0;padding:0;background-color:#070013;color:#cfb279;font-family:Georgia,'Times New Roman',serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#070013;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#0f031d;border:1px solid #461303;overflow:hidden;">
                  <tr>
                    <td style="padding:30px 32px;background-color:#070013;border-bottom:3px solid #592bad;color:#cfb279;text-align:center;">
                      <div style="font-size:13px;letter-spacing:3px;font-weight:bold;text-transform:uppercase;">Mu Campana</div>
                      <div style="margin-top:10px;font-size:28px;line-height:36px;font-weight:bold;">Bienvenid@, guerrer@</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:36px 32px 12px;">
                      <p style="margin:0 0 16px;font-size:18px;line-height:28px;color:#cfb279;">Hola, <strong>${displayName}</strong>.</p>
                      <p style="margin:0;font-size:15px;line-height:25px;color:#b5a5c6;">Tu cuenta se ha creado correctamente. Ya puedes comenzar tu aventura en Mu Campana.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 32px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#070013;border:1px solid #592bad;">
                        <tr>
                          <td style="padding:20px 24px;">
                            <div style="font-size:12px;line-height:18px;color:#b5a5c6;text-transform:uppercase;letter-spacing:1px;">Tu contraseña</div>
                            <div style="margin-top:8px;color:#cfb279;font-size:26px;line-height:34px;font-weight:bold;letter-spacing:2px;">${password}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 32px 36px;">
                      <p style="margin:0;font-size:14px;line-height:23px;color:#b5a5c6;">Esta es la contraseña de tu cuenta. Guárdala en un lugar seguro y no la compartas con nadie.</p>
                      <p style="margin:24px 0 0;font-size:15px;line-height:24px;color:#cfb279;font-weight:bold;">Nos vemos dentro, guerrer@.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 32px;background-color:#461303;text-align:center;">
                      <p style="margin:0;color:#cfb279;font-size:12px;line-height:20px;">Este mensaje fue enviado automáticamente. No respondas a este correo.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    return this.sendEmail([recipient], subject, htmlContent);
  }

  async sendPasswordResetEmail(
    recipient: EmailRecipient,
    token: string,
  ): Promise<SendTransacEmailResponse> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Recuperación de contraseña';
    const displayName = this.escapeHtml(recipient.name || 'guerrero');
    const htmlContent = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperación de contraseña</title>
        </head>
        <body style="margin:0;padding:0;background-color:#070013;color:#cfb279;font-family:Georgia,'Times New Roman',serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#070013;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#0f031d;border:1px solid #461303;overflow:hidden;">
                  <tr>
                    <td style="padding:30px 32px;background-color:#070013;border-bottom:3px solid #592bad;color:#cfb279;text-align:center;">
                      <div style="font-size:13px;letter-spacing:3px;font-weight:bold;text-transform:uppercase;">Mu Campana</div>
                      <div style="margin-top:10px;font-size:28px;line-height:36px;font-weight:bold;">Recupera tu acceso</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:36px 32px 12px;">
                      <p style="margin:0 0 16px;font-size:18px;line-height:28px;color:#cfb279;">Hola, <strong>${displayName}</strong>.</p>
                      <p style="margin:0;font-size:15px;line-height:25px;color:#b5a5c6;">Recibimos una solicitud para cambiar la contraseña de tu cuenta de Mu Campana.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:24px 32px 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#592bad" style="background-color:#592bad;border:1px solid #cfb279;">
                            <a href="${resetUrl}" style="display:inline-block;padding:15px 28px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Cambiar contraseña</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 36px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#070013;border:1px solid #461303;">
                        <tr>
                          <td style="padding:18px 20px;">
                            <p style="margin:0;font-size:13px;line-height:22px;color:#b5a5c6;">Este enlace estará disponible durante 1 hora. Si no solicitaste este cambio, puedes ignorar este correo.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 32px;background-color:#461303;text-align:center;">
                      <p style="margin:0;color:#cfb279;font-size:12px;line-height:20px;">Este mensaje fue enviado automáticamente. No respondas a este correo.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    return this.sendEmail([recipient], subject, htmlContent);
  }
}
