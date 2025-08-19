const express = require('express');
const { requireAuth } = require('../middleware/auth');
const ExportService = require('../utils/exportService');
const OSINTAnalyticsService = require('../services/osintAnalyticsService');
const { logger } = require('../config/database');

const router = express.Router();
const exportService = new ExportService();
const analyticsService = new OSINTAnalyticsService();

// ===== EXPORT ROUTES =====

// Export search results to CSV
router.post('/csv/search-results', requireAuth, async (req, res) => {
  try {
    const { results, filename } = req.body;
    
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        error: 'Results array is required'
      });
    }
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    const exportResult = await exportService.exportSearchResultsToCSV(results, filename);
    
    res.json({
      success: true,
      message: 'Search results exported to CSV successfully',
      data: exportResult
    });
  } catch (error) {
    logger.error('Failed to export search results to CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export OSINT report to CSV
router.post('/csv/report', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier, targetType, filename, options = {} } = req.body;
    
    if (!targetIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Target identifier is required'
      });
    }
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    // Generate the report first
    const report = await analyticsService.generateReport(targetIdentifier, targetType, options);
    
    // Export to CSV
    const exportResult = await exportService.exportReportToCSV(report, filename);
    
    res.json({
      success: true,
      message: 'OSINT report exported to CSV successfully',
      data: exportResult
    });
  } catch (error) {
    logger.error('Failed to export OSINT report to CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export OSINT report to PDF/HTML
router.post('/pdf/report', requireAuth, async (req, res) => {
  try {
    const { targetIdentifier, targetType, filename, options = {} } = req.body;
    
    if (!targetIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Target identifier is required'
      });
    }
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    // Generate the report first
    const report = await analyticsService.generateReport(targetIdentifier, targetType, options);
    
    // Export to PDF/HTML
    const exportResult = await exportService.exportReportToPDF(report, filename);
    
    res.json({
      success: true,
      message: 'OSINT report exported successfully',
      data: exportResult
    });
  } catch (error) {
    logger.error('Failed to export OSINT report to PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export custom data to CSV
router.post('/csv/custom', requireAuth, async (req, res) => {
  try {
    const { data, filename, options = {} } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'Data array is required'
      });
    }
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    const exportResult = await exportService.exportToCSV(data, filename, options);
    
    res.json({
      success: true,
      message: 'Custom data exported to CSV successfully',
      data: exportResult
    });
  } catch (error) {
    logger.error('Failed to export custom data to CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== EXPORT MANAGEMENT =====

// List all export files
router.get('/files', requireAuth, async (req, res) => {
  try {
    const exports = await exportService.listExports();
    
    res.json({
      success: true,
      data: exports
    });
  } catch (error) {
    logger.error('Failed to list exports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get export file info
router.get('/files/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const fileInfo = await exportService.getExportInfo(filename);
    
    if (!fileInfo.exists) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found'
      });
    }
    
    res.json({
      success: true,
      data: fileInfo
    });
  } catch (error) {
    logger.error('Failed to get export file info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download export file
router.get('/download/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const fileInfo = await exportService.getExportInfo(filename);
    
    if (!fileInfo.exists) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found'
      });
    }
    
    // Set appropriate headers for file download
    const ext = fileInfo.filename.split('.').pop();
    let contentType = 'application/octet-stream';
    
    if (ext === 'csv') {
      contentType = 'text/csv';
    } else if (ext === 'html') {
      contentType = 'text/html';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fs = require('fs');
    const fileStream = fs.createReadStream(fileInfo.filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    logger.error('Failed to download export file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete export file
router.delete('/files/:filename', requireAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await exportService.deleteExport(filename);
    
    res.json({
      success: true,
      message: 'Export file deleted successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to delete export file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clean up old exports
router.post('/cleanup', requireAuth, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    const result = await exportService.cleanupOldExports(daysOld);
    
    res.json({
      success: true,
      message: 'Export cleanup completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to cleanup old exports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== BATCH EXPORT =====

// Batch export multiple reports
router.post('/batch', requireAuth, async (req, res) => {
  try {
    const { exports, format = 'csv' } = req.body;
    
    if (!exports || !Array.isArray(exports) || exports.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Exports array is required and must not be empty'
      });
    }
    
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Format must be either "csv" or "pdf"'
      });
    }
    
    const results = [];
    
    for (const exportItem of exports) {
      try {
        const { targetIdentifier, targetType, filename, options = {} } = exportItem;
        
        if (!targetIdentifier || !filename) {
          results.push({
            targetIdentifier,
            filename,
            success: false,
            error: 'Missing required fields'
          });
          continue;
        }
        
        // Generate report
        const report = await analyticsService.generateReport(targetIdentifier, targetType, options);
        
        // Export based on format
        let exportResult;
        if (format === 'csv') {
          exportResult = await exportService.exportReportToCSV(report, filename);
        } else {
          exportResult = await exportService.exportReportToPDF(report, filename);
        }
        
        results.push({
          targetIdentifier,
          filename,
          success: true,
          data: exportResult
        });
        
      } catch (error) {
        results.push({
          targetIdentifier: exportItem.targetIdentifier,
          filename: exportItem.filename,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    res.json({
      success: true,
      message: `Batch export completed: ${successCount} successful, ${failureCount} failed`,
      data: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        results
      }
    });
    
  } catch (error) {
    logger.error('Failed to perform batch export:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
