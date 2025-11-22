require('dotenv').config();
const { sendNotificationEmail } = require('./emailNotification');

const testEmail = process.env.TEST_EMAIL_RECIPIENT || 'reymundedra@gmail.com';

sendNotificationEmail(
  testEmail,
  'Test Email Subject',
  'This is a test email from FMIS-BUDGET-SEPTEMBER.'
).then(() => {
  console.log('Email sent successfully to:', testEmail);
  process.exit(0);
}).catch(err => {
  console.error('Email sending failed:', err);
  process.exit(1);
});
