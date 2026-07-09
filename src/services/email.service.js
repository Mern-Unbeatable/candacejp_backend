import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
  );
}

class EmailService {
  #transporter = null;

  getTransporter() {
    if (!isSmtpConfigured()) {
      return null;
    }

    if (!this.#transporter) {
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;

      this.#transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    return this.#transporter;
  }

  getFromAddress() {
    return process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  async sendPasswordResetOtp(email, otp) {
    const subject = 'Your Raven password reset code';
    const text = `Your Raven password reset code is: ${otp}. It expires in 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 8px;">Reset your password</h2>
        <p>Use this verification code to reset your Raven account password:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
        <p style="color: #6b7280;">This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p>
      </div>
    `;

    const transporter = this.getTransporter();

    if (!transporter) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP is not configured');
      }

      logger.info(`[DEV] Password reset OTP for ${email}: ${otp}`);
      console.log(`\n[DEV] Password reset OTP for ${email}: ${otp}\n`);
      return;
    }

    await transporter.sendMail({
      from: this.getFromAddress(),
      to: email,
      subject,
      text,
      html,
    });

    logger.info(`Password reset OTP email sent to ${email}`);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[DEV] Password reset OTP for ${email}: ${otp}\n`);
    }
  }
}

export default new EmailService();
