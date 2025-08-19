const express = require('express');
const { requireAuth } = require('../middleware/auth');
const OSINTAnalyticsService = require('../services/osintAnalyticsService');
const { logger } = require('../config/database');

const router = express.Router();
const analyticsService = new OSINTAnalyticsService();

// ===== RESULT CORRELATION =====

// Correlate results for a specific target
router.get('/correlate/:targetIdentifier', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier } = req.params;
    const { targetType } = req.query;
    
    const correlation = await analyticsService.correlateResults(targetIdentifier, targetType);
    
    res.json({
      success: true,
      data: correlation
    });
  } catch (error) {
    logger.error('Failed to correlate results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== REPORTING =====

// Generate comprehensive OSINT report
router.post('/reports/generate', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier, targetType, options = {} } = req.body;
    
    if (!targetIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Target identifier is required'
      });
    }
    
    const report = await analyticsService.generateReport(targetIdentifier, targetType, options);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Failed to generate report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get report for a specific target
router.get('/reports/:targetIdentifier', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier } = req.params;
    const { targetType, includeCorrelations, includeTimeline, includeRiskAssessment, includeRecommendations } = req.query;
    
    const options = {
      includeCorrelations: includeCorrelations !== 'false',
      includeTimeline: includeTimeline !== 'false',
      includeRiskAssessment: includeRiskAssessment !== 'false',
      includeRecommendations: includeRecommendations !== 'false'
    };
    
    const report = await analyticsService.generateReport(targetIdentifier, targetType, options);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Failed to get report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export report in different formats
router.get('/reports/:targetIdentifier/export/:format', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier, format } = req.params;
    const { targetType } = req.query;
    
    if (!['json', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format. Supported formats: json, csv, pdf'
      });
    }
    
    const report = await analyticsService.generateReport(targetIdentifier, targetType);
    
    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="osint_report_${targetIdentifier}.json"`);
        res.json(report);
        break;
        
      case 'csv':
        const csv = await analyticsService.convertReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="osint_report_${targetIdentifier}.csv"`);
        res.send(csv);
        break;
        
      case 'pdf':
        // TODO: Implement PDF generation
        res.status(501).json({
          success: false,
          error: 'PDF export not yet implemented'
        });
        break;
        
      default:
        res.status(400).json({
          success: false,
          error: 'Unsupported export format'
        });
    }
  } catch (error) {
    logger.error('Failed to export report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== TIMELINE =====

// Get timeline for a specific target
router.get('/timeline/:targetIdentifier', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier } = req.params;
    
    const timeline = await analyticsService.generateTimeline(targetIdentifier);
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    logger.error('Failed to get timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== RISK ASSESSMENT =====

// Get risk assessment for a specific target
router.get('/risk-assessment/:targetIdentifier', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier } = req.params;
    
    const riskAssessment = await analyticsService.assessRisk(targetIdentifier);
    
    res.json({
      success: true,
      data: riskAssessment
    });
  } catch (error) {
    logger.error('Failed to get risk assessment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== RECOMMENDATIONS =====

// Get recommendations for a specific target
router.get('/recommendations/:targetIdentifier', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier } = req.params;
    
    const recommendations = await analyticsService.generateRecommendations(targetIdentifier);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    logger.error('Failed to get recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== ANALYTICS DASHBOARD =====

// Get analytics dashboard data
router.get('/analytics/dashboard', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const userId = req.user.userId;
    
    const dashboard = await analyticsService.getAnalyticsDashboard(userId, timeRange);
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Failed to get analytics dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get overall statistics
router.get('/analytics/stats', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const timeFilter = analyticsService.getTimeFilter(timeRange);
    const stats = await analyticsService.getOverallStats(timeFilter);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get overall stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tool usage statistics
router.get('/analytics/tools', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const timeFilter = analyticsService.getTimeFilter(timeRange);
    const toolStats = await analyticsService.getToolUsageStats(timeFilter);
    
    res.json({
      success: true,
      data: toolStats
    });
  } catch (error) {
    logger.error('Failed to get tool usage stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get result type statistics
router.get('/analytics/result-types', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const timeFilter = analyticsService.getTimeFilter(timeRange);
    const resultTypeStats = await analyticsService.getResultTypeStats(timeFilter);
    
    res.json({
      success: true,
      data: resultTypeStats
    });
  } catch (error) {
    logger.error('Failed to get result type stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user activity
router.get('/analytics/user-activity', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const userId = req.user.userId;
    
    const timeFilter = analyticsService.getTimeFilter(timeRange);
    const userActivity = await analyticsService.getUserActivity(userId, timeFilter);
    
    res.json({
      success: true,
      data: userActivity
    });
  } catch (error) {
    logger.error('Failed to get user activity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get trending targets
router.get('/analytics/trending', requireAuth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const timeFilter = analyticsService.getTimeFilter(timeRange);
    const trendingTargets = await analyticsService.getTrendingTargets(timeFilter);
    
    res.json({
      success: true,
      data: trendingTargets
    });
  } catch (error) {
    logger.error('Failed to get trending targets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== BATCH OPERATIONS =====

// Correlate multiple targets
router.post('/correlate/batch', requireAuth, async (req, res) => {
  try {
    const { targets, targetType } = req.body;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Targets array is required and must not be empty'
      });
    }
    
    if (targets.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 targets allowed per batch request'
      });
    }
    
    const correlations = [];
    
    for (const target of targets) {
      try {
        const correlation = await analyticsService.correlateResults(target, targetType);
        correlations.push(correlation);
      } catch (error) {
        logger.warn(`Failed to correlate target ${target}:`, error.message);
        correlations.push({
          target,
          error: error.message,
          correlations: [],
          summary: { totalResults: 0, uniqueSources: 0, confidenceScore: 0 }
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        totalTargets: targets.length,
        successfulCorrelations: correlations.filter(c => !c.error).length,
        failedCorrelations: correlations.filter(c => c.error).length,
        correlations
      }
    });
  } catch (error) {
    logger.error('Failed to process batch correlation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate reports for multiple targets
router.post('/reports/batch', requireAuth, async (req, res) => {
  try {
    const { targets, targetType, options = {} } = req.body;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Targets array is required and must not be empty'
      });
    }
    
    if (targets.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 targets allowed per batch report request'
      });
    }
    
    const reports = [];
    
    for (const target of targets) {
      try {
        const report = await analyticsService.generateReport(target, targetType, options);
        reports.push(report);
      } catch (error) {
        logger.warn(`Failed to generate report for target ${target}:`, error.message);
        reports.push({
          metadata: { target, targetType, generatedAt: new Date().toISOString() },
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        totalTargets: targets.length,
        successfulReports: reports.filter(r => !r.error).length,
        failedReports: reports.filter(r => r.error).length,
        reports
      }
    });
  } catch (error) {
    logger.error('Failed to process batch reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
