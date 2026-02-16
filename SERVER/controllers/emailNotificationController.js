/**
 * Email Notification Controller
 * Sends email notifications for workflow actions
 * 
 * Note: nodemailer is already installed in package.json
 * Configure SMTP settings in .env:
 * SMTP_HOST=smtp.gmail.com
 * SMTP_PORT=587
 * SMTP_USER=your-email@nia.gov.ph
 * SMTP_PASS=your-app-password
 * APP_URL=https://budget.nia.gov.ph
 */

const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send workflow action email notification
 */
const sendWorkflowEmail = async (recipientEmail, recipientName, action, proposal, comment = '') => {
  try {
    const transporter = createTransporter();

    const actionMessages = {
      'submit-to-reviewer': {
        subject: `Proposal Submitted for Review: ${proposal.title}`,
        message: `Your proposal "${proposal.title}" has been submitted for review.`,
      },
      'submit-to-approver': {
        subject: `Proposal Submitted for Approval: ${proposal.title}`,
        message: `Your proposal "${proposal.title}" has been submitted for approval.`,
      },
      'forward-to-officer': {
        subject: `Proposal Forwarded to Officer: ${proposal.title}`,
        message: `A proposal "${proposal.title}" requires your review and action.`,
      },
      'finalize': {
        subject: `Proposal Finalized: ${proposal.title}`,
        message: `The proposal "${proposal.title}" has been finalized.`,
      },
      'return-to-preparer': {
        subject: `Proposal Returned: ${proposal.title}`,
        message: `The proposal "${proposal.title}" has been returned for revision. ${comment ? `Comment: ${comment}` : ''}`,
      },
    };

    const emailContent = actionMessages[action] || {
      subject: `Proposal Status Updated: ${proposal.title}`,
      message: `The status of proposal "${proposal.title}" has been updated.`,
    };

    const mailOptions = {
      from: `"FMIS Budget System" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: emailContent.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #264524;">FMIS Budget System</h2>
          <p>Hello ${recipientName},</p>
          <p>${emailContent.message}</p>
          ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
          <p><strong>Proposal Details:</strong></p>
          <ul>
            <li>Title: ${proposal.title}</li>
            <li>Fiscal Year: ${proposal.fiscalYear}</li>
            <li>Status: ${proposal.status}</li>
          </ul>
          <p>
            <a href="${process.env.APP_URL || 'https://budget.nia.gov.ph'}/allproposal?proposalId=${proposal._id}" 
               style="background-color: #375e38; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Proposal
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This is an automated email from the FMIS Budget System. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send deadline reminder email
 */
const sendDeadlineReminder = async (recipientEmail, recipientName, deadline, proposals = []) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"FMIS Budget System" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: `Deadline Reminder: Budget Proposal Submission`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #264524;">Deadline Reminder</h2>
          <p>Hello ${recipientName},</p>
          <p>This is a reminder that the budget proposal submission deadline is approaching.</p>
          <p><strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
          ${proposals.length > 0 ? `
            <p>You have ${proposals.length} pending proposal(s):</p>
            <ul>
              ${proposals.map(p => `<li>${p.title}</li>`).join('')}
            </ul>
          ` : ''}
          <p>
            <a href="${process.env.APP_URL || 'https://budget.nia.gov.ph'}/dashboard" 
               style="background-color: #375e38; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Go to Dashboard
            </a>
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending deadline reminder:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWorkflowEmail,
  sendDeadlineReminder,
};
