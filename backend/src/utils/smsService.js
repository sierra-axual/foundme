const twilio = require('twilio');
const { logger } = require('../config/database');

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
    
    if (this.accountSid && this.authToken && this.fromNumber) {
      this.client = twilio(this.accountSid, this.authToken);
    } else {
      logger.warn('Twilio credentials not configured. SMS service will be disabled.');
      this.client = null;
    }
  }

  // Check if SMS service is available
  isAvailable() {
    return !!this.client;
  }

  // Send a generic SMS
  async sendSMS(to, message) {
    if (!this.isAvailable()) {
      logger.warn('SMS service not available. Skipping SMS send.');
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      logger.info(`SMS sent successfully to ${to}`, { 
        messageId: response.sid,
        status: response.status 
      });
      
      return { 
        success: true, 
        messageId: response.sid,
        status: response.status,
        message: 'SMS sent successfully'
      };
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to send SMS'
      };
    }
  }

  // Send security alert SMS
  async sendSecurityAlertSMS(to, alertType, details) {
    const message = `🚨 SECURITY ALERT: ${alertType}\n\n${details}\n\nTime: ${new Date().toLocaleString()}\n\nReview immediately at: https://foundme.com/dashboard`;
    
    return await this.sendSMS(to, message);
  }

  // Send risk alert SMS
  async sendRiskAlertSMS(to, target, riskScore, riskLevel) {
    const message = `⚠️ RISK ALERT: ${target}\n\nRisk Score: ${riskScore}/100\nRisk Level: ${riskLevel.toUpperCase()}\n\nReview at: https://foundme.com/dashboard`;
    
    return await this.sendSMS(to, message);
  }

  // Send scan completion SMS
  async sendScanCompletionSMS(to, target, riskScore) {
    const message = `✅ SCAN COMPLETE: ${target}\n\nRisk Score: ${riskScore}/100\n\nView results at: https://foundme.com/dashboard`;
    
    return await this.sendSMS(to, message);
  }

  // Send breach detection SMS
  async sendBreachDetectionSMS(to, breachName, riskLevel) {
    const message = `🚨 BREACH DETECTED: ${breachName}\n\nRisk Level: ${riskLevel.toUpperCase()}\n\nReview at: https://foundme.com/dashboard`;
    
    return await this.sendSMS(to, message);
  }

  // Send two-factor authentication code
  async send2FACode(to, code) {
    const message = `🔐 FoundMe 2FA Code: ${code}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this message.`;
    
    return await this.sendSMS(to, message);
  }

  // Send account lockout notification
  async sendAccountLockoutSMS(to, lockoutReason, unlockTime) {
    const message = `🔒 ACCOUNT LOCKED\n\nReason: ${lockoutReason}\nUnlock Time: ${unlockTime}\n\nContact support if you need immediate assistance.`;
    
    return await this.sendSMS(to, message);
  }

  // Send subscription renewal reminder
  async sendSubscriptionRenewalSMS(to, planName, renewalDate, amount) {
    const message = `💳 SUBSCRIPTION RENEWAL\n\nPlan: ${planName}\nRenewal Date: ${renewalDate}\nAmount: $${amount}\n\nManage at: https://foundme.com/billing`;
    
    return await this.sendSMS(to, message);
  }

  // Send weekly summary SMS
  async sendWeeklySummarySMS(to, summary) {
    const message = `📊 WEEKLY SUMMARY\n\nNew Findings: ${summary.newFindings}\nRisk Trend: ${summary.riskTrend}\nScans: ${summary.scansCompleted}\n\nView full report at: https://foundme.com/reports`;
    
    return await this.sendSMS(to, message);
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber) {
    // Basic validation - can be enhanced with more sophisticated regex
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  // Format phone number for Twilio
  formatPhoneNumber(phoneNumber) {
    let formatted = phoneNumber.replace(/\s/g, '');
    
    // Add + if not present
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    
    return formatted;
  }

  // Get message status
  async getMessageStatus(messageId) {
    if (!this.isAvailable()) {
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const message = await this.client.messages(messageId).fetch();
      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        direction: message.direction,
        from: message.from,
        to: message.to,
        body: message.body,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      logger.error('Failed to get message status:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to get message status'
      };
    }
  }

  // Get message history for a phone number
  async getMessageHistory(phoneNumber, limit = 50) {
    if (!this.isAvailable()) {
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const messages = await this.client.messages.list({
        to: phoneNumber,
        limit: limit
      });

      return {
        success: true,
        messages: messages.map(msg => ({
          messageId: msg.sid,
          status: msg.status,
          direction: msg.direction,
          body: msg.body,
          dateCreated: msg.dateCreated,
          dateSent: msg.dateSent
        }))
      };
    } catch (error) {
      logger.error('Failed to get message history:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to get message history'
      };
    }
  }
}

module.exports = SMSService;
