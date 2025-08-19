const sgMail = require('@sendgrid/mail');
const { logger } = require('../config/database');

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@foundme.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'FoundMe Platform';
    
    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
    } else {
      logger.warn('SendGrid API key not configured. Email service will be disabled.');
    }
  }

  // Check if email service is available
  isAvailable() {
    return !!this.apiKey;
  }

  // Send a generic email
  async sendEmail(to, subject, htmlContent, textContent = null) {
    if (!this.isAvailable()) {
      logger.warn('Email service not available. Skipping email send.');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        html: htmlContent,
        ...(textContent && { text: textContent })
      };

      const response = await sgMail.send(msg);
      logger.info(`Email sent successfully to ${to}`, { messageId: response[0].headers['x-message-id'] });
      
      return { 
        success: true, 
        messageId: response[0].headers['x-message-id'],
        message: 'Email sent successfully'
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to send email'
      };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(to, resetToken, resetUrl) {
    const subject = 'Password Reset Request - FoundMe Platform';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3748;">Password Reset Request</h2>
        <p>You have requested to reset your password for your FoundMe Platform account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}?token=${resetToken}" 
           style="display: inline-block; background-color: #4299e1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Reset Password
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #718096;">${resetUrl}?token=${resetToken}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px;">
          This is an automated message from FoundMe Platform. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
      Password Reset Request - FoundMe Platform
      
      You have requested to reset your password for your FoundMe Platform account.
      
      Click this link to reset your password: ${resetUrl}?token=${resetToken}
      
      This link will expire in 1 hour.
      
      If you didn't request this password reset, please ignore this email.
    `;

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  // Send email verification email
  async sendVerificationEmail(to, verificationToken, verificationUrl) {
    const subject = 'Verify Your Email - FoundMe Platform';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3748;">Welcome to FoundMe Platform!</h2>
        <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
        <p>Click the button below to verify your email:</p>
        <a href="${verificationUrl}?token=${verificationToken}" 
           style="display: inline-block; background-color: #48bb78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Verify Email
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #718096;">${verificationUrl}?token=${verificationToken}</p>
        <p><strong>This link will expire in 24 hours.</strong></p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px;">
          This is an automated message from FoundMe Platform. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
      Welcome to FoundMe Platform!
      
      Thank you for registering. Please verify your email address to complete your account setup.
      
      Click this link to verify your email: ${verificationUrl}?token=${verificationToken}
      
      This link will expire in 24 hours.
    `;

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  // Send security alert email
  async sendSecurityAlertEmail(to, alertType, details) {
    const subject = `Security Alert - ${alertType} - FoundMe Platform`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e53e3e;">Security Alert</h2>
        <p><strong>Alert Type:</strong> ${alertType}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <div style="background-color: #fed7d7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #c53030; margin-top: 0;">Alert Details:</h3>
          <pre style="white-space: pre-wrap; font-family: monospace;">${JSON.stringify(details, null, 2)}</pre>
        </div>
        <p>Please review this alert and take appropriate action if necessary.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px;">
          This is an automated security alert from FoundMe Platform. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
      Security Alert - ${alertType} - FoundMe Platform
      
      Alert Type: ${alertType}
      Time: ${new Date().toLocaleString()}
      
      Alert Details:
      ${JSON.stringify(details, null, 2)}
      
      Please review this alert and take appropriate action if necessary.
    `;

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  // Send weekly report email
  async sendWeeklyReportEmail(to, reportData) {
    const subject = `Weekly Security Report - ${reportData.weekOf} - FoundMe Platform`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d3748;">Weekly Security Report</h2>
        <p><strong>Week of:</strong> ${reportData.weekOf}</p>
        
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="color: #4a5568; margin-top: 0;">Summary</h3>
          <p><strong>New Findings:</strong> ${reportData.newFindings}</p>
          <p><strong>Risk Trend:</strong> ${reportData.riskTrend}</p>
          <p><strong>Scans Completed:</strong> ${reportData.scansCompleted}</p>
        </div>
        
        <p>View your full report at: <a href="${reportData.reportUrl}">${reportData.reportUrl}</a></p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px;">
          This is an automated weekly report from FoundMe Platform. Please do not reply to this email.
        </p>
      </div>
    `;

    const textContent = `
      Weekly Security Report - ${reportData.weekOf} - FoundMe Platform
      
      Week of: ${reportData.weekOf}
      
      Summary:
      - New Findings: ${reportData.newFindings}
      - Risk Trend: ${reportData.riskTrend}
      - Scans Completed: ${reportData.scansCompleted}
      
      View your full report at: ${reportData.reportUrl}
    `;

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }
}

module.exports = EmailService;
