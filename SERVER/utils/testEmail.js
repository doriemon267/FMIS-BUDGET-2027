require('dotenv').config();
const { sendNotificationEmail } = require('./emailNotification');

sendNotificationEmail(
  'reymundedra@gmail.com', // Replace with your test email
  'Test Email Subject',
  'This is a test email from FMIS-BUDGET-SEPTEMBER.'
).then(() => {
  console.log('Email sent successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Email sending failed:', err);
  process.exit(1);
});
