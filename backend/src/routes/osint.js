const express = require('express');
const router = express.Router();
const OSINTDataService = require('../services/osintDataService');
const { logger } = require('../config/database');

// Initialize the OSINT data service
const osintService = new OSINTDataService();

// Import proper authentication middleware
const { requireAuth } = require('../middleware/auth');

// GET /api/osint/status - Get OSINT service status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const status = {
      service: 'FoundMe OSINT Data Service',
      status: 'operational',
      timestamp: new Date().toISOString(),
      user_id: req.user.userId
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get OSINT status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

// POST /api/osint/search/username - Search by username
router.post('/search/username', requireAuth, async (req, res) => {
  try {
    const { username, session_name } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    const searchData = {
      search_type: 'username',
      target_identifier: username,
      session_name: session_name || `Username search for ${username}`,
      metadata: {
        search_method: 'username_enumeration',
        tools: ['sherlock', 'maigret']
      }
    };

    const session = await osintService.createSearchSession(req.user.userId, searchData);

    res.json({
      success: true,
      data: {
        session_id: session.id,
        status: session.status,
        message: 'Username search started successfully',
        session: session
      }
    });
  } catch (error) {
    logger.error('Username search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start username search'
    });
  }
});

// POST /api/osint/search/email - Search by email
router.post('/search/email', requireAuth, async (req, res) => {
  try {
    const { email, session_name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const searchData = {
      search_type: 'email',
      target_identifier: email,
      session_name: session_name || `Email search for ${email}`,
      metadata: {
        search_method: 'email_investigation',
        tools: ['holehe', 'h8mail', 'theharvester']
      }
    };

    const session = await osintService.createSearchSession(req.user.userId, searchData);

    res.json({
      success: true,
      data: {
        session_id: session.id,
        status: session.status,
        message: 'Email search started successfully',
        session: session
      }
    });
  } catch (error) {
    logger.error('Email search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start email search'
    });
  }
});

// POST /api/osint/search/phone - Search by phone (placeholder)
router.post('/search/phone', requireAuth, async (req, res) => {
  try {
    const { phone, session_name } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Phone search is not yet implemented
    res.status(501).json({
      success: false,
      error: 'Phone number search is not yet implemented',
      message: 'This feature will be available in future updates'
    });
  } catch (error) {
    logger.error('Phone search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process phone search request'
    });
  }
});

// POST /api/osint/search/full-profile - Full profile search
router.post('/search/full-profile', requireAuth, async (req, res) => {
  try {
    const { username, email, phone, session_name } = req.body;

    if (!username && !email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'At least one identifier (username, email, or phone) is required'
      });
    }

    const searchData = {
      search_type: 'full_profile',
      target_identifier: { username, email, phone },
      session_name: session_name || 'Full profile investigation',
      metadata: {
        search_method: 'comprehensive_investigation',
        tools: ['sherlock', 'maigret', 'holehe', 'h8mail', 'theharvester'],
        identifiers: { username: !!username, email: !!email, phone: !!phone }
      }
    };

    const session = await osintService.createSearchSession(req.user.userId, searchData);

    res.json({
      success: true,
      data: {
        session_id: session.id,
        status: session.status,
        message: 'Full profile search started successfully',
        session: session
      }
    });
  } catch (error) {
    logger.error('Full profile search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start full profile search'
    });
  }
});

// GET /api/osint/session/:sessionId - Get search session details
router.get('/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { results, summary } = req.query;

    const sessionData = await osintService.getSearchSession(sessionId, req.user.userId);

    let responseData = {
      session: sessionData.session
    };

    if (results === 'true') {
      responseData.results = sessionData.results;
    }

    if (summary === 'true') {
      responseData.summary = sessionData.summary;
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error(`Failed to get session ${req.params.sessionId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get search session'
    });
  }
});

// GET /api/osint/history - Get user's search history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const history = await osintService.getUserSearchHistory(
      req.user.userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: history.length
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get search history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get search history'
    });
  }
});

// GET /api/osint/results - Search OSINT results
router.get('/results', requireAuth, async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0,
      target_identifier,
      target_type,
      tool_name,
      result_type,
      min_confidence,
      max_confidence,
      is_verified,
      tags,
      date_from,
      date_to
    } = req.query;

    const criteria = {};

    if (target_identifier) criteria.target_identifier = target_identifier;
    if (target_type) criteria.target_type = target_type;
    if (tool_name) criteria.tool_name = tool_name;
    if (result_type) criteria.result_type = result_type;
    if (min_confidence !== undefined) criteria.min_confidence = parseFloat(min_confidence);
    if (max_confidence !== undefined) criteria.max_confidence = parseFloat(max_confidence);
    if (is_verified !== undefined) criteria.is_verified = is_verified === 'true';
    if (tags) criteria.tags = tags.split(',');
    if (date_from) criteria.date_from = new Date(date_from);
    if (date_to) criteria.date_to = new Date(date_to);

    const results = await osintService.searchOSINTResults(
      criteria,
      req.user.userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: {
        results,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: results.length
        },
        criteria
      }
    });
  } catch (error) {
    logger.error('Failed to search OSINT results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search OSINT results'
    });
  }
});

// GET /api/osint/stats - Get OSINT statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { 
      target_type,
      tool_name,
      date_from,
      date_to
    } = req.query;

    const criteria = {};

    if (target_type) criteria.target_type = target_type;
    if (tool_name) criteria.tool_name = tool_name;
    if (date_from) criteria.date_from = new Date(date_from);
    if (date_to) criteria.date_to = new Date(date_to);

    const stats = await osintService.getOSINTStats(req.user.userId, criteria);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get OSINT statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get OSINT statistics'
    });
  }
});

// GET /api/osint/export/:sessionId - Export search results
router.get('/export/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;

    if (!['json', 'csv'].includes(format.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format. Use "json" or "csv"'
      });
    }

    const exportData = await osintService.exportSearchResults(sessionId, format, req.user.userId);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.send(exportData.data);
    } else {
      res.json({
        success: true,
        data: exportData.data
      });
    }
  } catch (error) {
    logger.error(`Failed to export session ${req.params.sessionId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export search results'
    });
  }
});

// DELETE /api/osint/session/:sessionId - Delete search session
router.delete('/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session to check ownership
    const session = await osintService.getSearchSession(sessionId, req.user.userId);
    
    // Delete the session
    await session.session.delete();

    res.json({
      success: true,
      message: 'Search session deleted successfully'
    });
  } catch (error) {
    logger.error(`Failed to delete session ${req.params.sessionId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete search session'
    });
  }
});

// GET /api/osint/tools/status - Get available OSINT tools status
router.get('/tools/status', requireAuth, async (req, res) => {
  try {
    const toolsStatus = await osintService.reconftwService.checkToolAvailability();

    res.json({
      success: true,
      data: {
        tools: toolsStatus,
        total_available: Object.values(toolsStatus).filter(tool => tool.available).length,
        total_tools: Object.keys(toolsStatus).length
      }
    });
  } catch (error) {
    logger.error('Failed to get tools status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tools status'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('OSINT route error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

module.exports = router;
