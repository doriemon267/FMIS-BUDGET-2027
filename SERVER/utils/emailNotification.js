const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');

// Strip CRLF and control chars to prevent email header injection
function safeHeaderValue(value) {
  if (value == null || typeof value !== 'string') return '';
  return value.replace(/[\r\n\x00-\x1f]/g, '').trim();
}

// Basic email format check (local@domain, reasonable length)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmailFormat(str) {
  return typeof str === 'string' && str.length <= 254 && EMAIL_REGEX.test(str);
}

// Normalize recipient: single email, no header-injection chars
function normalizeTo(to) {
  const s = safeHeaderValue(String(to));
  const first = s.split(',')[0].trim();
  return first || s;
}

// Configure sanitizer options for email content (no script/style; strict schemes)
const sanitizeOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'hr'
  ],
  allowedAttributes: {
    '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'cellpadding', 'cellspacing', 'border', 'bgcolor', 'color', 'title', 'colspan', 'rowspan'],
    'a': ['href', 'title', 'style'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'style']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: true,
  selfClosing: ['br', 'hr'],
  allowVulnerableTags: false
};

// Configure transporter - supports both Gmail and generic SMTP
let transporter;

if (process.env.MAIL_HOST) {
  // Use MAIL configuration from .env (Laravel-style)
  const secure = process.env.MAIL_ENCRYPTION === 'ssl' || process.env.MAIL_PORT === '465';
  // Determine SNI hostname for secure TLS connections; avoid using an IP address for SNI
  const net = require('net');
  const mailSniOverride = process.env.MAIL_SNI_HOST && process.env.MAIL_SNI_HOST.trim();
  const mailHost = process.env.MAIL_HOST;
  const mailTlsServername = mailSniOverride || (!net.isIP(mailHost) ? mailHost : undefined);
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 587,
    secure: secure,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD
    }
    , tls: mailTlsServername ? { servername: mailTlsServername } : undefined
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
    , tls: ((!net.isIP(process.env.SMTP_HOST)) ? { servername: process.env.SMTP_HOST } : undefined)
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

  // Prevent header injection: sanitize to and subject (no CRLF / control chars)
  const safeTo = normalizeTo(to);
  const safeSubject = safeHeaderValue(subject);
  if (!safeTo || !isValidEmailFormat(safeTo)) {
    throw new Error('Invalid recipient: empty or invalid email address.');
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
    to: safeTo,
    subject: safeSubject || 'Notification',
    text: typeof text === 'string' ? text : '',
    html: sanitizedHtml
  };

  // Retry logic
  const sendWithRetry = async (attempt = 1) => {
    try {
      const result = await transporter.sendMail(mailOptions);
      console.log(`[Email] Successfully sent to ${safeTo} on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.warn(`[Email] Attempt ${attempt} failed for ${safeTo}:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: wait 2^attempt seconds
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Email] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return sendWithRetry(attempt + 1);
      } else {
        console.error(`[Email] All ${maxRetries} attempts failed for ${safeTo}`);
        throw new Error(`Email delivery failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  };

  return sendWithRetry();
}

module.exports = { sendNotificationEmail };