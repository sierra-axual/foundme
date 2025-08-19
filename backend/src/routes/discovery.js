const express = require('express');
const { z } = require('zod');
const DiscoveryService = require('../services/discoveryService');
const { logger } = require('../config/database');

const router = express.Router();
const discoveryService = new DiscoveryService();

// Validation schemas
const scanRequestSchema = z.object({
  targetType: z.enum(['person', 'company', 'domain', 'email']),
  targetValue: z.string().min(1),
  scanDepth: z.enum(['basic', 'comprehensive', 'deep']).default('basic'),
  includeSocialMedia: z.boolean().default(true),
  includeDarkWeb: z.boolean().default(false),
  includeMetadata: z.boolean().default(true)
});

// Start a new discovery scan
router.post('/scan', async (req, res) => {
  try {
    const validatedData = scanRequestSchema.parse(req.body);
    
    // Get user ID from request body or authentication (for testing)
    const userId = req.body.userId || req.user?.userId || '00000000-0000-0000-0000-000000000000';
    
    const scanData = {
      ...validatedData,
      userId
    };

    const result = await discoveryService.startDiscoveryScan(scanData);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        scanId: result.scanId,
        estimatedDuration: result.estimatedDuration
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Discovery scan request failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get scan status
router.get('/status/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    const scanStatus = await discoveryService.getScanStatus(scanId);
    
    if (scanStatus) {
      res.json({
        success: true,
        scan: scanStatus
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scan not found'
      });
    }

  } catch (error) {
    logger.error('Scan status request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get scan results
router.get('/results/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    const scanStatus = await discoveryService.getScanStatus(scanId);
    const scanResults = await discoveryService.getScanResults(scanId);
    
    if (scanStatus) {
      res.json({
        success: true,
        scan: scanStatus,
        results: scanResults
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scan not found'
      });
    }

  } catch (error) {
    logger.error('Scan results request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's scan history
router.get('/history', async (req, res) => {
  try {
    // TODO: Implement user scan history
    const userId = req.user?.userId || '00000000-0000-0000-0000-000000000000';
    
    res.json({
      success: true,
      message: 'Scan history endpoint - to be implemented',
      userId
    });

  } catch (error) {
    logger.error('Scan history request failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel a running scan
router.post('/cancel/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    // TODO: Implement scan cancellation
    res.json({
      success: true,
      message: 'Scan cancellation - to be implemented',
      scanId
    });

  } catch (error) {
    logger.error('Scan cancellation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
