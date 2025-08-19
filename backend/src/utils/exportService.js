const fs = require('fs').promises;
const path = require('path');
const { postgresPool, logger } = require('../config/database');

class ExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../../exports');
    this.ensureExportDirectory();
  }

  // Ensure export directory exists
  async ensureExportDirectory() {
    try {
      await fs.access(this.exportDir);
    } catch (error) {
      await fs.mkdir(this.exportDir, { recursive: true });
      logger.info('Export directory created');
    }
  }

  // ===== CSV EXPORT =====

  // Export OSINT results to CSV
  async exportToCSV(data, filename, options = {}) {
    try {
      const {
        includeHeaders = true,
        delimiter = ',',
        encoding = 'utf8'
      } = options;

      let csvContent = '';

      if (includeHeaders && data.length > 0) {
        const headers = Object.keys(data[0]);
        csvContent += headers.map(header => this.escapeCSVField(header)).join(delimiter) + '\n';
      }

      for (const row of data) {
        const csvRow = Object.values(row).map(value => this.escapeCSVField(value));
        csvContent += csvRow.join(delimiter) + '\n';
      }

      const filePath = path.join(this.exportDir, `${filename}.csv`);
      await fs.writeFile(filePath, csvContent, encoding);

      logger.info(`CSV export completed: ${filePath}`);
      return {
        success: true,
        filePath,
        filename: `${filename}.csv`,
        recordCount: data.length,
        format: 'csv'
      };
    } catch (error) {
      logger.error('Failed to export CSV:', error);
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  // Export OSINT report to CSV
  async exportReportToCSV(report, filename) {
    try {
      const csvData = [];

      // Add report metadata
      csvData.push({
        'Report Type': 'OSINT Report',
        'Target': report.metadata?.target || 'Unknown',
        'Generated At': report.metadata?.generatedAt || new Date().toISOString(),
        'Report ID': report.metadata?.reportId || 'N/A'
      });

      // Add summary data
      if (report.summary) {
        csvData.push({
          'Total Results': report.summary.totalResults || 0,
          'Unique Sources': report.summary.uniqueSources || 0,
          'Confidence Score': report.summary.confidenceScore || 0,
          'Correlation Count': report.summary.correlationCount || 0
        });
      }

      // Add correlations
      if (report.correlations && report.correlations.length > 0) {
        csvData.push({}); // Empty row for separation
        csvData.push({
          'Correlation Type': 'HEADER',
          'Confidence': 'HEADER',
          'Similarity': 'HEADER',
          'Evidence': 'HEADER'
        });

        for (const correlation of report.correlations) {
          csvData.push({
            'Correlation Type': correlation.type || 'N/A',
            'Confidence': correlation.confidence || 0,
            'Similarity': correlation.similarity || 0,
            'Evidence': (correlation.evidence || []).join('; ')
          });
        }
      }

      // Add timeline data
      if (report.timeline && report.timeline.length > 0) {
        csvData.push({}); // Empty row for separation
        csvData.push({
          'Timestamp': 'HEADER',
          'Tool': 'HEADER',
          'Type': 'HEADER',
          'Confidence': 'HEADER',
          'Session': 'HEADER'
        });

        for (const timelineItem of report.timeline) {
          csvData.push({
            'Timestamp': timelineItem.timestamp || 'N/A',
            'Tool': timelineItem.tool || 'N/A',
            'Type': timelineItem.type || 'N/A',
            'Confidence': timelineItem.confidence || 0,
            'Session': timelineItem.session || 'N/A'
          });
        }
      }

      // Add risk assessment
      if (report.riskAssessment) {
        csvData.push({}); // Empty row for separation
        csvData.push({
          'Risk Assessment': 'HEADER',
          'Risk Score': 'HEADER',
          'Risk Level': 'HEADER',
          'Risk Factors': 'HEADER'
        });

        csvData.push({
          'Risk Assessment': 'Summary',
          'Risk Score': report.riskAssessment.riskScore || 0,
          'Risk Level': report.riskAssessment.riskLevel || 'N/A',
          'Risk Factors': (report.riskAssessment.riskFactors || []).join('; ')
        });
      }

      // Add recommendations
      if (report.recommendations && report.recommendations.length > 0) {
        csvData.push({}); // Empty row for separation
        csvData.push({
          'Priority': 'HEADER',
          'Category': 'HEADER',
          'Title': 'HEADER',
          'Description': 'HEADER',
          'Actions': 'HEADER'
        });

        for (const recommendation of report.recommendations) {
          csvData.push({
            'Priority': recommendation.priority || 'N/A',
            'Category': recommendation.category || 'N/A',
            'Title': recommendation.title || 'N/A',
            'Description': recommendation.description || 'N/A',
            'Actions': (recommendation.actions || []).join('; ')
          });
        }
      }

      return await this.exportToCSV(csvData, filename, { delimiter: ',' });
    } catch (error) {
      logger.error('Failed to export report to CSV:', error);
      throw new Error(`Report CSV export failed: ${error.message}`);
    }
  }

  // Export search results to CSV
  async exportSearchResultsToCSV(results, filename) {
    try {
      const csvData = results.map(result => ({
        'ID': result.id || 'N/A',
        'Target Identifier': result.target_identifier || 'N/A',
        'Target Type': result.target_type || 'N/A',
        'Tool Name': result.tool_name || 'N/A',
        'Result Type': result.result_type || 'N/A',
        'Confidence Score': result.confidence_score || 0,
        'Discovered At': result.discovered_at || 'N/A',
        'Tags': (result.tags || []).join('; '),
        'Result Data': JSON.stringify(result.result_data || {})
      }));

      return await this.exportToCSV(csvData, filename);
    } catch (error) {
      logger.error('Failed to export search results to CSV:', error);
      throw new Error(`Search results CSV export failed: ${error.message}`);
    }
  }

  // Escape CSV field values
  escapeCSVField(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains delimiter, quote, or newline, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  // ===== PDF EXPORT =====

  // Export OSINT report to PDF
  async exportReportToPDF(report, filename) {
    try {
      // For now, we'll create a simple HTML report that can be converted to PDF
      // In a production environment, you might want to use a proper PDF library like puppeteer
      const htmlContent = this.generateReportHTML(report);
      
      const filePath = path.join(this.exportDir, `${filename}.html`);
      await fs.writeFile(filePath, htmlContent, 'utf8');

      logger.info(`HTML report generated: ${filePath}`);
      
      // TODO: Implement actual PDF conversion using puppeteer or similar
      // For now, return the HTML file path
      return {
        success: true,
        filePath,
        filename: `${filename}.html`,
        format: 'html',
        note: 'HTML report generated. PDF conversion requires additional setup.'
      };
    } catch (error) {
      logger.error('Failed to export report to PDF:', error);
      throw new Error(`PDF export failed: ${error.message}`);
    }
  }

  // Generate HTML report content
  generateReportHTML(report) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OSINT Report - ${report.metadata?.target || 'Unknown Target'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
        .risk-high { border-left-color: #e74c3c; }
        .risk-medium { border-left-color: #f39c12; }
        .risk-low { border-left-color: #27ae60; }
        .correlation-item { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .timeline-item { border-left: 3px solid #3498db; padding-left: 15px; margin: 10px 0; }
        .recommendation { background: #fff3cd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffc107; }
        .recommendation.high { background: #f8d7da; border-left-color: #dc3545; }
        .recommendation.medium { background: #fff3cd; border-left-color: #ffc107; }
        .recommendation.low { background: #d1ecf1; border-left-color: #17a2b8; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .footer { text-align: center; margin-top: 40px; padding: 20px; color: #666; border-top: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 OSINT Intelligence Report</h1>
        <p><strong>Target:</strong> ${report.metadata?.target || 'Unknown'}</p>
        <p><strong>Generated:</strong> ${new Date(report.metadata?.generatedAt || Date.now()).toLocaleString()}</p>
        <p><strong>Report ID:</strong> ${report.metadata?.reportId || 'N/A'}</p>
    </div>

    ${this.generateSummarySection(report)}
    ${this.generateCorrelationsSection(report)}
    ${this.generateTimelineSection(report)}
    ${this.generateRiskAssessmentSection(report)}
    ${this.generateRecommendationsSection(report)}

    <div class="footer">
        <p>Report generated by FoundMe OSINT Platform</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

    return html;
  }

  // Generate summary section HTML
  generateSummarySection(report) {
    if (!report.summary) return '';
    
    return `
    <div class="section">
        <h2>📊 Executive Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Results</h3>
                <p style="font-size: 24px; font-weight: bold; color: #2c3e50;">${report.summary.totalResults || 0}</p>
            </div>
            <div class="summary-card">
                <h3>Unique Sources</h3>
                <p style="font-size: 24px; font-weight: bold; color: #2c3e50;">${report.summary.uniqueSources || 0}</p>
            </div>
            <div class="summary-card">
                <h3>Confidence Score</h3>
                <p style="font-size: 24px; font-weight: bold; color: #2c3e50;">${((report.summary.confidenceScore || 0) * 100).toFixed(1)}%</p>
            </div>
            <div class="summary-card">
                <h3>Correlations</h3>
                <p style="font-size: 24px; font-weight: bold; color: #2c3e50;">${report.summary.correlationCount || 0}</p>
            </div>
        </div>
    </div>`;
  }

  // Generate correlations section HTML
  generateCorrelationsSection(report) {
    if (!report.correlations || report.correlations.length === 0) return '';
    
    const correlationRows = report.correlations.map(corr => `
        <tr>
            <td>${corr.type || 'N/A'}</td>
            <td>${((corr.confidence || 0) * 100).toFixed(1)}%</td>
            <td>${((corr.similarity || 0) * 100).toFixed(1)}%</td>
            <td>${(corr.evidence || []).join(', ')}</td>
        </tr>
    `).join('');

    return `
    <div class="section">
        <h2>🔗 Data Correlations</h2>
        <table>
            <thead>
                <tr>
                    <th>Correlation Type</th>
                    <th>Confidence</th>
                    <th>Similarity</th>
                    <th>Evidence</th>
                </tr>
            </thead>
            <tbody>
                ${correlationRows}
            </tbody>
        </table>
    </div>`;
  }

  // Generate timeline section HTML
  generateTimelineSection(report) {
    if (!report.timeline || report.timeline.length === 0) return '';
    
    const timelineItems = report.timeline.map(item => `
        <div class="timeline-item">
            <strong>${new Date(item.timestamp).toLocaleString()}</strong> - ${item.tool || 'Unknown Tool'}
            <br><em>${item.type || 'Unknown Type'}</em> (Confidence: ${((item.confidence || 0) * 100).toFixed(1)}%)
            <br>Session: ${item.session || 'N/A'}
        </div>
    `).join('');

    return `
    <div class="section">
        <h2>⏰ Timeline of Findings</h2>
        ${timelineItems}
    </div>`;
  }

  // Generate risk assessment section HTML
  generateRiskAssessmentSection(report) {
    if (!report.riskAssessment) return '';
    
    const riskClass = `risk-${report.riskAssessment.riskLevel || 'low'}`;
    
    return `
    <div class="section">
        <h2>⚠️ Risk Assessment</h2>
        <div class="summary-card ${riskClass}">
            <h3>Risk Level: ${(report.riskAssessment.riskLevel || 'low').toUpperCase()}</h3>
            <p><strong>Risk Score:</strong> ${((report.riskAssessment.riskScore || 0) * 100).toFixed(1)}%</p>
            <p><strong>Total Findings:</strong> ${report.riskAssessment.totalFindings || 0}</p>
            <p><strong>Data Breaches:</strong> ${report.riskAssessment.breachCount || 0}</p>
            <p><strong>Social Exposure:</strong> ${report.riskAssessment.socialExposure || 0}</p>
            <p><strong>Personal Info Exposure:</strong> ${report.riskAssessment.personalExposure || 0}</p>
        </div>
        
        ${report.riskAssessment.riskFactors && report.riskAssessment.riskFactors.length > 0 ? `
        <h4>Risk Factors:</h4>
        <ul>
            ${report.riskAssessment.riskFactors.map(factor => `<li>${factor}</li>`).join('')}
        </ul>
        ` : ''}
    </div>`;
  }

  // Generate recommendations section HTML
  generateRecommendationsSection(report) {
    if (!report.recommendations || report.recommendations.length === 0) return '';
    
    const recommendationItems = report.recommendations.map(rec => `
        <div class="recommendation ${rec.priority || 'low'}">
            <h4>${rec.title || 'Recommendation'}</h4>
            <p><strong>Priority:</strong> ${(rec.priority || 'low').toUpperCase()}</p>
            <p><strong>Category:</strong> ${rec.category || 'General'}</p>
            <p>${rec.description || 'No description available'}</p>
            ${rec.actions && rec.actions.length > 0 ? `
            <h5>Recommended Actions:</h5>
            <ul>
                ${rec.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
            ` : ''}
        </div>
    `).join('');

    return `
    <div class="section">
        <h2>💡 Recommendations</h2>
        ${recommendationItems}
    </div>`;
  }

  // ===== UTILITY METHODS =====

  // Get export file info
  async getExportInfo(filename) {
    try {
      const filePath = path.join(this.exportDir, filename);
      const stats = await fs.stat(filePath);
      
      return {
        filename,
        filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        exists: true
      };
    } catch (error) {
      return {
        filename,
        exists: false,
        error: error.message
      };
    }
  }

  // List all export files
  async listExports() {
    try {
      const files = await fs.readdir(this.exportDir);
      const exportFiles = [];
      
      for (const file of files) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);
        
        exportFiles.push({
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          format: path.extname(file).substring(1)
        });
      }
      
      return exportFiles.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      logger.error('Failed to list exports:', error);
      return [];
    }
  }

  // Delete export file
  async deleteExport(filename) {
    try {
      const filePath = path.join(this.exportDir, filename);
      await fs.unlink(filePath);
      
      logger.info(`Export file deleted: ${filename}`);
      return { success: true, message: 'Export file deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete export:', error);
      throw new Error(`Failed to delete export: ${error.message}`);
    }
  }

  // Clean up old exports (older than specified days)
  async cleanupOldExports(daysOld = 30) {
    try {
      const files = await this.listExports();
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      const oldFiles = files.filter(file => file.modified < cutoffDate);
      
      let deletedCount = 0;
      for (const file of oldFiles) {
        try {
          await this.deleteExport(file.filename);
          deletedCount++;
        } catch (error) {
          logger.warn(`Failed to delete old export ${file.filename}:`, error);
        }
      }
      
      logger.info(`Cleanup completed: ${deletedCount} old export files deleted`);
      return { success: true, deletedCount, totalOldFiles: oldFiles.length };
    } catch (error) {
      logger.error('Failed to cleanup old exports:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }
}

module.exports = ExportService;
