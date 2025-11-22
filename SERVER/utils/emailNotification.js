const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

// Configure sanitizer options for email content
const sanitizeOptions = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: {
    'a': ['href', 'title'],
    'table': ['border', 'cellpadding', 'cellspacing', 'style'],
    'th': ['style'],
    'td': ['style', 'colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  selfClosing: ['br']
};

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
 * Send notification email with retry logic
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Email body
 * @param {string} html - Email HTML content (optional)
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 */
function sendNotificationEmail(to, subject, text, html, maxRetries = 3) {
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

  // Sanitize HTML content if provided
  let sanitizedHtml = html;
  if (html) {
    sanitizedHtml = sanitizeHtml(html, sanitizeOptions);
  }

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html: sanitizedHtml
  };

  // Retry logic
  const sendWithRetry = async (attempt = 1) => {
    try {
      const result = await transporter.sendMail(mailOptions);
      console.log(`[Email] Successfully sent to ${to} on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.warn(`[Email] Attempt ${attempt} failed for ${to}:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: wait 2^attempt seconds
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Email] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendWithRetry(attempt + 1);
      } else {
        console.error(`[Email] All ${maxRetries} attempts failed for ${to}`);
        throw new Error(`Email delivery failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  };

  return sendWithRetry();
}

module.exports = { sendNotificationEmail };