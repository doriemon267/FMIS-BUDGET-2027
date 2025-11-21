const nodemailer = require('nodemailer');

// Configure transporter - supports both Gmail and generic SMTP
let transporter;

if (process.env.MAIL_HOST) {
  // Use MAIL configuration from .env (Laravel-style)
  const secure = process.env.MAIL_ENCRYPTION === 'ssl' || process.env.MAIL_PORT === '465';
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: secure,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    }
  });
  console.log('[emailNotification] ✓ Configured with MAIL_* settings');
} else if (process.env.SMTP_HOST) {
  // Use SMTP configuration from .env
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true' || false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('[emailNotification] ✓ Configured with SMTP_* settings');
} else {
  console.error('[emailNotification] ✗ No email configuration found in environment variables');
  console.error('[emailNotification] Please set MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD');
}

/**
 * Send notification email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Email body
 */
function sendNotificationEmail(to, subject, text, html) {
  if (!transporter) {
    throw new Error('Email transporter is not configured. Check environment variables.');
  }
  
  let fromEmail = process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || process.env.EMAIL_USER;
  const fromName = process.env.MAIL_FROM_NAME || 'FMIS - BUDGET';
  
  if (!fromEmail) {
    throw new Error('No email sender configured in environment variables.');
  }

  // Format: "Name <email@domain.com>"
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html
  };
  
  return transporter.sendMail(mailOptions);
}

module.exports = { sendNotificationEmail };