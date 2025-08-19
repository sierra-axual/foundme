const EmailService = require('../utils/emailService');
const SMSService = require('../utils/smsService');
const { postgresPool, redisClient, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class NotificationService {
  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  // Send notification through multiple channels
  async sendNotification(notificationData) {
    const {
      userId,
      type,
      subject,
      message,
      priority = 'normal',
      channels = ['email'],
      metadata = {},
      scheduledFor = null
    } = notificationData;

    try {
      // Create notification record
      const notificationId = await this.createNotificationRecord({
        userId,
        type,
        subject,
        message,
        priority,
        channels,
        metadata,
        scheduledFor
      });

      // If scheduled for later, don't send immediately
      if (scheduledFor && new Date(scheduledFor) > new Date()) {
        return {
          success: true,
          notificationId,
          message: 'Notification scheduled for later delivery',
          scheduledFor
        };
      }

      // Send through each channel
      const results = {};
      for (const channel of channels) {
        results[channel] = await this.sendThroughChannel(channel, {
          userId,
          subject,
          message,
          metadata
        });
      }

      // Update notification status
      await this.updateNotificationStatus(notificationId, 'sent', results);

      return {
        success: true,
        notificationId,
        results,
        message: 'Notification sent successfully'
      };

    } catch (error) {
      logger.error('Failed to send notification:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to send notification'
      };
    }
  }

  // Send notification through a specific channel
  async sendThroughChannel(channel, data) {
    try {
      switch (channel) {
        case 'email':
          return await this.sendEmailNotification(data);
        case 'sms':
          return await this.sendSMSNotification(data);
        case 'push':
          return await this.sendPushNotification(data);
        case 'webhook':
          return await this.sendWebhookNotification(data);
        case 'in_app':
          return await this.sendInAppNotification(data);
        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }
    } catch (error) {
      logger.error(`Failed to send ${channel} notification:`, error);
      return {
        success: false,
        channel,
        error: error.message
      };
    }
  }

  // Send email notification
  async sendEmailNotification(data) {
    const { userId, subject, message, metadata } = data;
    
    try {
      // Get user email from database
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check user preferences
      const preferences = await this.getUserNotificationPreferences(userId, 'email');
      if (!preferences.is_enabled) {
        return { success: false, reason: 'Email notifications disabled by user' };
      }

      // Send email
      const result = await this.emailService.sendEmail(
        user.email,
        subject,
        this.formatEmailMessage(message, metadata),
        message
      );

      return {
        success: result.success,
        channel: 'email',
        recipient: user.email,
        messageId: result.messageId,
        ...(result.error && { error: result.error })
      };

    } catch (error) {
      logger.error('Failed to send email notification:', error);
      return {
        success: false,
        channel: 'email',
        error: error.message
      };
    }
  }

  // Send SMS notification
  async sendSMSNotification(data) {
    const { userId, message, metadata } = data;
    
    try {
      // Get user phone from database
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile || !userProfile.phone) {
        return { success: false, reason: 'User phone number not available' };
      }

      // Check user preferences
      const preferences = await this.getUserNotificationPreferences(userId, 'sms');
      if (!preferences.is_enabled) {
        return { success: false, reason: 'SMS notifications disabled by user' };
      }

      // Send SMS
      const result = await this.smsService.sendSMS(
        userProfile.phone,
        this.formatSMSMessage(message, metadata)
      );

      return {
        success: result.success,
        channel: 'sms',
        recipient: userProfile.phone,
        messageId: result.messageId,
        ...(result.error && { error: result.error })
      };

    } catch (error) {
      logger.error('Failed to send SMS notification:', error);
      return {
        success: false,
        channel: 'sms',
        error: error.message
      };
    }
  }

  // Send push notification (placeholder for future implementation)
  async sendPushNotification(data) {
    // TODO: Implement push notification service
    logger.info('Push notifications not yet implemented');
    return {
      success: false,
      channel: 'push',
      reason: 'Push notifications not yet implemented'
    };
  }

  // Send webhook notification
  async sendWebhookNotification(data) {
    const { userId, message, metadata } = data;
    
    try {
      // Get user webhook preferences
      const preferences = await this.getUserNotificationPreferences(userId, 'webhook');
      if (!preferences.is_enabled || !preferences.webhook_url) {
        return { success: false, reason: 'Webhook not configured' };
      }

      // TODO: Implement webhook delivery
      logger.info('Webhook notifications not yet implemented');
      return {
        success: false,
        channel: 'webhook',
        reason: 'Webhook notifications not yet implemented'
      };

    } catch (error) {
      logger.error('Failed to send webhook notification:', error);
      return {
        success: false,
        channel: 'webhook',
        error: error.message
      };
    }
  }

  // Send in-app notification
  async sendInAppNotification(data) {
    const { userId, subject, message, metadata } = data;
    
    try {
      // Store in-app notification in database
      const result = await this.createInAppNotification({
        userId,
        subject,
        message,
        metadata
      });

      return {
        success: true,
        channel: 'in_app',
        notificationId: result.id,
        message: 'In-app notification created successfully'
      };

    } catch (error) {
      logger.error('Failed to send in-app notification:', error);
      return {
        success: false,
        channel: 'in_app',
        error: error.message
      };
    }
  }

  // Create notification record in database
  async createNotificationRecord(notificationData) {
    const {
      userId,
      type,
      subject,
      message,
      priority,
      channels,
      metadata,
      scheduledFor
    } = notificationData;

    const query = `
      INSERT INTO notifications (
        id, user_id, type, subject, message, priority, status, 
        recipient, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `;

    const values = [
      uuidv4(),
      userId,
      type,
      subject,
      message,
      priority,
      scheduledFor ? 'scheduled' : 'pending',
      channels.join(','),
      JSON.stringify(metadata)
    ];

    const result = await postgresPool.query(query, values);
    return result.rows[0].id;
  }

  // Update notification status
  async updateNotificationStatus(notificationId, status, results = {}) {
    const query = `
      UPDATE notifications 
      SET status = $1, sent_at = $2, updated_at = NOW()
      WHERE id = $3
    `;

    const sentAt = status === 'sent' ? new Date() : null;
    await postgresPool.query(query, [status, sentAt, notificationId]);

    // Log delivery results
    if (Object.keys(results).length > 0) {
      await this.logDeliveryResults(notificationId, results);
    }
  }

  // Log delivery results
  async logDeliveryResults(notificationId, results) {
    for (const [channel, result] of Object.entries(results)) {
      if (result.success) {
        await this.createDeliveryLog(notificationId, channel, 'delivered', result);
      } else {
        await this.createDeliveryLog(notificationId, channel, 'failed', result);
      }
    }
  }

  // Create delivery log entry
  async createDeliveryLog(notificationId, channel, status, result) {
    const query = `
      INSERT INTO notification_delivery_logs (
        notification_id, delivery_attempt, provider, provider_message_id,
        status, error_message, response_data, attempted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;

    const values = [
      notificationId,
      1,
      channel,
      result.messageId || null,
      status,
      result.error || null,
      JSON.stringify(result)
    ];

    await postgresPool.query(query, values);
  }

  // Create in-app notification
  async createInAppNotification(data) {
    const { userId, subject, message, metadata } = data;

    const query = `
      INSERT INTO notifications (
        id, user_id, type, subject, message, priority, status,
        recipient, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id
    `;

    const values = [
      uuidv4(),
      userId,
      'in_app',
      subject,
      message,
      'normal',
      'delivered',
      'in_app',
      JSON.stringify(metadata)
    ];

    const result = await postgresPool.query(query, values);
    return result.rows[0];
  }

  // Get user by ID
  async getUserById(userId) {
    const result = await postgresPool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  // Get user profile
  async getUserProfile(userId) {
    const result = await postgresPool.query(
      'SELECT user_id, phone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  // Get user notification preferences
  async getUserNotificationPreferences(userId, type) {
    const result = await postgresPool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1 AND type = $2',
      [userId, type]
    );
    return result.rows[0] || { is_enabled: true }; // Default to enabled if no preferences set
  }

  // Format email message
  formatEmailMessage(message, metadata) {
    let formattedMessage = message;
    
    // Replace placeholders with metadata values
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        formattedMessage = formattedMessage.replace(
          new RegExp(`{{${key}}}`, 'g'), 
          value
        );
      });
    }
    
    return formattedMessage;
  }

  // Format SMS message
  formatSMSMessage(message, metadata) {
    let formattedMessage = message;
    
    // Replace placeholders with metadata values
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        formattedMessage = formattedMessage.replace(
          new RegExp(`{{${key}}}`, 'g'), 
          value
        );
      });
    }
    
    // Truncate if too long (SMS limit is typically 160 characters)
    if (formattedMessage.length > 160) {
      formattedMessage = formattedMessage.substring(0, 157) + '...';
    }
    
    return formattedMessage;
  }

  // Get user notifications
  async getUserNotifications(userId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const result = await postgresPool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId, userId) {
    const query = `
      UPDATE notifications 
      SET read_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;

    const result = await postgresPool.query(query, [notificationId, userId]);
    return result.rowCount > 0;
  }

  // Get unread notification count
  async getUnreadNotificationCount(userId) {
    const query = `
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = $1 AND read_at IS NULL
    `;

    const result = await postgresPool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  // Clean up old notifications
  async cleanupOldNotifications(daysOld = 90) {
    const query = `
      DELETE FROM notifications 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      AND status IN ('delivered', 'failed', 'cancelled')
    `;

    const result = await postgresPool.query(query);
    logger.info(`Cleaned up ${result.rowCount} old notifications`);
    return result.rowCount;
  }
}

module.exports = NotificationService;
