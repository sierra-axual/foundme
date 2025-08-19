const express = require('express');
const EmailService = require('../utils/emailService');
const SMSService = require('../utils/smsService');
const FileUploadService = require('../utils/fileUploadService');
const NotificationService = require('../services/notificationService');
const { logger } = require('../config/database');

const router = express.Router();

// Test utility services
router.get('/utils', async (req, res) => {
  try {
    const emailService = new EmailService();
    const smsService = new SMSService();
    const fileUploadService = new FileUploadService();

    const results = {
      email: {
        available: emailService.isAvailable(),
        configured: !!process.env.SENDGRID_API_KEY
      },
      sms: {
        available: smsService.isAvailable(),
        configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
      },
      fileUpload: {
        uploadDir: fileUploadService.uploadDir,
        maxFileSize: fileUploadService.maxFileSize,
        allowedImageTypes: fileUploadService.allowedImageTypes,
        allowedDocumentTypes: fileUploadService.allowedDocumentTypes
      }
    };

    res.json({
      success: true,
      message: 'Utility services status',
      results
    });

  } catch (error) {
    logger.error('Test utilities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test notification service
router.get('/notifications', async (req, res) => {
  try {
    const notificationService = new NotificationService();
    
    // Test creating a sample notification (won't actually send without proper credentials)
    const testNotification = {
      userId: '00000000-0000-0000-0000-000000000000', // Use a valid UUID format
      type: 'test',
      subject: 'Test Notification',
      message: 'This is a test notification from the FoundMe platform.',
      channels: ['in_app'],
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    const result = await notificationService.sendNotification(testNotification);

    res.json({
      success: true,
      message: 'Notification service test completed',
      result
    });

  } catch (error) {
    logger.error('Test notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test file upload service
router.get('/file-upload', async (req, res) => {
  try {
    const fileUploadService = new FileUploadService();
    
    const allowedTypes = fileUploadService.getAllowedFileTypes();
    const uploadDir = fileUploadService.uploadDir;

    res.json({
      success: true,
      message: 'File upload service configuration',
      allowedTypes,
      uploadDir,
      maxFileSize: `${allowedTypes.maxFileSize / (1024 * 1024)} MB`
    });

  } catch (error) {
    logger.error('Test file upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test environment variables
router.get('/env', (req, res) => {
  try {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'Configured' : 'Not configured',
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured',
      UPLOAD_DIR: process.env.UPLOAD_DIR,
      MAX_FILE_SIZE: process.env.MAX_FILE_SIZE
    };

    res.json({
      success: true,
      message: 'Environment variables status',
      envVars
    });

  } catch (error) {
    logger.error('Test env error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test discovery service
router.get('/discovery', async (req, res) => {
  try {
    const DiscoveryService = require('../services/discoveryService');
    const discoveryService = new DiscoveryService();
    
    // Test discovery service initialization
    const testResult = {
      serviceInitialized: !!discoveryService,
      browserStatus: discoveryService.browser ? 'Initialized' : 'Not initialized',
      maxConcurrentScans: discoveryService.maxConcurrentScans,
      scanTimeout: discoveryService.scanTimeout,
      userAgents: discoveryService.userAgents.length
    };

    res.json({
      success: true,
      message: 'Discovery service test completed',
      result: testResult
    });

  } catch (error) {
    logger.error('Test discovery error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
