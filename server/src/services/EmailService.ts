import nodemailer from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export class EmailService {
  private static createTransport() {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;
    if (isTest || process.env.MAILER_TRANSPORT === 'json') {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error('Missing SMTP configuration');
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  static async sendMail(options: {
    to: string[];
    subject: string;
    text: string;
    attachments?: EmailAttachment[];
  }) {
    const transporter = this.createTransport();
    const from = process.env.SMTP_FROM || 'no-reply@example.local';

    return transporter.sendMail({
      from,
      to: options.to.join(','),
      subject: options.subject,
      text: options.text,
      attachments: options.attachments
    });
  }
}
