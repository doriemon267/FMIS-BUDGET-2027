const { sendNotificationEmail } = require('./utils/emailNotification');
require('dotenv').config();

async function testEmailNotification() {
  try {
    console.log('Starting email notification test...');
    console.log('Email configuration:');
    console.log('- SMTP_HOST:', process.env.SMTP_HOST);
    console.log('- SMTP_PORT:', process.env.SMTP_PORT);
    console.log('- SMTP_USER:', process.env.SMTP_USER);
    console.log('- EMAIL_USER:', process.env.EMAIL_USER);
    console.log('');

    const testEmail = process.env.SMTP_USER || process.env.EMAIL_USER;
    const subject = 'Test Email - Proposal Workflow Notification';
    const text = `This is a test email to verify that the email notification system is working correctly.
    
If you received this email, the email configuration is set up properly.

Test Details:
- Timestamp: ${new Date().toISOString()}
- From: ${testEmail}

Best regards,
FMIS Budget System`;

    const html = `
<p>This is a test email to verify that the email notification system is working correctly.</p>
<p>If you received this email, the email configuration is set up properly.</p>
<h3>Test Details:</h3>
<ul>
  <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
  <li><strong>From:</strong> ${testEmail}</li>
</ul>
<p>Best regards,<br/>FMIS Budget System</p>
`;

    console.log('Sending test email to:', testEmail);
    const result = await sendNotificationEmail(testEmail, subject, text, html);
    console.log('✓ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
  } catch (error) {
    console.error('✗ Email sending failed!');
    console.error('Error:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

testEmailNotification();
