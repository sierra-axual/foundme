const { postgresPool } = require('../config/database');
const { logger } = require('../config/database');

class OSINTAnalyticsService {
  constructor() {
    this.correlationThresholds = {
      confidence: 0.7,
      similarity: 0.8,
      timeWindow: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    };
  }

  // ===== RESULT CORRELATION =====

  // Correlate OSINT results across different tools and sessions
  async correlateResults(targetIdentifier, targetType = null) {
    try {
      logger.info(`Starting result correlation for: ${targetIdentifier}`);
      
      // Get all results for the target identifier
      const results = await this.getResultsForTarget(targetIdentifier, targetType);
      
      if (results.length === 0) {
        return {
          target: targetIdentifier,
          correlations: [],
          summary: {
            totalResults: 0,
            uniqueSources: 0,
            confidenceScore: 0
          }
        };
      }

      // Group results by type and source
      const groupedResults = this.groupResultsByType(results);
      
      // Find correlations between different result types
      const correlations = await this.findCorrelations(groupedResults);
      
      // Calculate overall confidence score
      const confidenceScore = this.calculateConfidenceScore(correlations);
      
      // Generate correlation summary
      const summary = {
        totalResults: results.length,
        uniqueSources: new Set(results.map(r => r.tool_name)).size,
        confidenceScore,
        correlationCount: correlations.length,
        resultTypes: Object.keys(groupedResults),
        lastUpdated: new Date().toISOString()
      };

      logger.info(`Correlation completed for ${targetIdentifier}: ${correlations.length} correlations found`);
      
      return {
        target: targetIdentifier,
        correlations,
        summary
      };
    } catch (error) {
      logger.error('Failed to correlate results:', error);
      throw new Error(`Failed to correlate results: ${error.message}`);
    }
  }

  // Get all results for a specific target
  async getResultsForTarget(targetIdentifier, targetType = null) {
    try {
      let query = `
        SELECT or.*, ss.session_name, ss.search_type, ss.created_at as search_date
        FROM osint_results or
        JOIN search_sessions ss ON or.search_session_id = ss.id
        WHERE or.target_identifier = $1
      `;
      
      const params = [targetIdentifier];
      
      if (targetType) {
        query += ' AND or.target_type = $2';
        params.push(targetType);
      }
      
      query += ' ORDER BY or.discovered_at DESC';
      
      const result = await postgresPool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get results for target:', error);
      throw error;
    }
  }

  // Group results by type and source
  groupResultsByType(results) {
    const grouped = {};
    
    results.forEach(result => {
      const type = result.result_type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(result);
    });
    
    return grouped;
  }

  // Find correlations between different result types
  async findCorrelations(groupedResults) {
    const correlations = [];
    const resultTypes = Object.keys(groupedResults);
    
    // Compare each result type with others
    for (let i = 0; i < resultTypes.length; i++) {
      for (let j = i + 1; j < resultTypes.length; j++) {
        const type1 = resultTypes[i];
        const type2 = resultTypes[j];
        
        const type1Results = groupedResults[type1];
        const type2Results = groupedResults[type2];
        
        // Find correlations between these two types
        const typeCorrelations = this.findTypeCorrelations(type1, type1Results, type2, type2Results);
        correlations.push(...typeCorrelations);
      }
    }
    
    // Sort correlations by confidence score
    correlations.sort((a, b) => b.confidence - a.confidence);
    
    return correlations;
  }

  // Find correlations between two specific result types
  findTypeCorrelations(type1, results1, type2, results2) {
    const correlations = [];
    
    results1.forEach(result1 => {
      results2.forEach(result2 => {
        const correlation = this.analyzeCorrelation(result1, result2);
        if (correlation.confidence >= this.correlationThresholds.confidence) {
          correlations.push({
            sourceType: type1,
            targetType: type2,
            sourceResult: result1.id,
            targetResult: result2.id,
            confidence: correlation.confidence,
            similarity: correlation.similarity,
            correlationType: correlation.type,
            evidence: correlation.evidence,
            discoveredAt: new Date().toISOString()
          });
        }
      });
    });
    
    return correlations;
  }

  // Analyze correlation between two results
  analyzeCorrelation(result1, result2) {
    let confidence = 0;
    let similarity = 0;
    let correlationType = 'weak';
    let evidence = [];
    
    // Check for exact matches
    if (result1.result_data && result2.result_data) {
      const data1 = result1.result_data;
      const data2 = result2.result_data;
      
      // Check for exact identifier matches
      if (data1.username && data2.username && data1.username === data2.username) {
        confidence += 0.4;
        similarity += 0.4;
        evidence.push('Exact username match');
      }
      
      if (data1.email && data2.email && data1.email === data2.email) {
        confidence += 0.4;
        similarity += 0.4;
        evidence.push('Exact email match');
      }
      
      if (data1.phone && data2.phone && data1.phone === data2.phone) {
        confidence += 0.4;
        similarity += 0.4;
        evidence.push('Exact phone match');
      }
      
      // Check for partial matches
      if (data1.name && data2.name) {
        const nameSimilarity = this.calculateStringSimilarity(data1.name, data2.name);
        if (nameSimilarity > 0.8) {
          confidence += 0.3;
          similarity += nameSimilarity * 0.3;
          evidence.push(`Name similarity: ${(nameSimilarity * 100).toFixed(1)}%`);
        }
      }
      
      // Check for location matches
      if (data1.location && data2.location) {
        const locationSimilarity = this.calculateStringSimilarity(data1.location, data2.location);
        if (locationSimilarity > 0.7) {
          confidence += 0.2;
          similarity += locationSimilarity * 0.2;
          evidence.push(`Location similarity: ${(locationSimilarity * 100).toFixed(1)}%`);
        }
      }
    }
    
    // Check for temporal proximity
    const timeDiff = Math.abs(new Date(result1.discovered_at) - new Date(result2.discovered_at));
    if (timeDiff < this.correlationThresholds.timeWindow) {
      confidence += 0.1;
      evidence.push('Temporal proximity');
    }
    
    // Determine correlation type
    if (confidence >= 0.8) correlationType = 'strong';
    else if (confidence >= 0.6) correlationType = 'moderate';
    else if (confidence >= 0.4) correlationType = 'weak';
    else correlationType = 'none';
    
    return {
      confidence: Math.min(confidence, 1.0),
      similarity: Math.min(similarity, 1.0),
      type: correlationType,
      evidence
    };
  }

  // Calculate string similarity using Levenshtein distance
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  // Levenshtein distance algorithm
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Calculate overall confidence score
  calculateConfidenceScore(correlations) {
    if (correlations.length === 0) return 0;
    
    const totalConfidence = correlations.reduce((sum, corr) => sum + corr.confidence, 0);
    const avgConfidence = totalConfidence / correlations.length;
    
    // Boost confidence based on number of correlations
    const correlationBonus = Math.min(correlations.length * 0.05, 0.2);
    
    return Math.min(avgConfidence + correlationBonus, 1.0);
  }

  // ===== REPORTING =====

  // Generate comprehensive OSINT report
  async generateReport(targetIdentifier, targetType = null, options = {}) {
    try {
      logger.info(`Generating OSINT report for: ${targetIdentifier}`);
      
      const {
        includeCorrelations = true,
        includeTimeline = true,
        includeRiskAssessment = true,
        includeRecommendations = true
      } = options;
      
      // Get correlation data
      const correlationData = includeCorrelations ? 
        await this.correlateResults(targetIdentifier, targetType) : null;
      
      // Get timeline data
      const timelineData = includeTimeline ? 
        await this.generateTimeline(targetIdentifier) : null;
      
      // Get risk assessment
      const riskAssessment = includeRiskAssessment ? 
        await this.assessRisk(targetIdentifier, correlationData) : null;
      
      // Get recommendations
      const recommendations = includeRecommendations ? 
        await this.generateRecommendations(targetIdentifier, riskAssessment) : null;
      
      // Compile report
      const report = {
        metadata: {
          target: targetIdentifier,
          targetType: targetType,
          generatedAt: new Date().toISOString(),
          reportId: this.generateReportId(targetIdentifier)
        },
        summary: correlationData?.summary || {},
        correlations: correlationData?.correlations || [],
        timeline: timelineData,
        riskAssessment,
        recommendations,
        exportFormats: ['json', 'pdf', 'csv']
      };
      
      logger.info(`OSINT report generated successfully for: ${targetIdentifier}`);
      return report;
    } catch (error) {
      logger.error('Failed to generate OSINT report:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  // Generate timeline of OSINT findings
  async generateTimeline(targetIdentifier) {
    try {
      const query = `
        SELECT 
          or.*,
          ss.session_name,
          ss.search_type,
          or.discovered_at as timestamp,
          or.confidence_score,
          or.tool_name,
          or.result_type
        FROM osint_results or
        JOIN search_sessions ss ON or.search_session_id = ss.id
        WHERE or.target_identifier = $1
        ORDER BY or.discovered_at ASC
      `;
      
      const result = await postgresPool.query(query, [targetIdentifier]);
      
      const timeline = result.rows.map(row => ({
        timestamp: row.timestamp,
        tool: row.tool_name,
        type: row.result_type,
        confidence: row.confidence_score,
        session: row.session_name,
        searchType: row.search_type,
        data: row.result_data
      }));
      
      return timeline;
    } catch (error) {
      logger.error('Failed to generate timeline:', error);
      throw error;
    }
  }

  // Assess risk based on OSINT findings
  async assessRisk(targetIdentifier, correlationData = null) {
    try {
      const results = await this.getResultsForTarget(targetIdentifier);
      
      let riskScore = 0;
      const riskFactors = [];
      const riskLevel = 'low';
      
      // Analyze data breaches
      const breachResults = results.filter(r => r.result_type === 'breach');
      if (breachResults.length > 0) {
        riskScore += breachResults.length * 0.2;
        riskFactors.push(`Found in ${breachResults.length} data breach(es)`);
      }
      
      // Analyze social media exposure
      const socialResults = results.filter(r => r.result_type === 'social_account');
      if (socialResults.length > 0) {
        const publicAccounts = socialResults.filter(r => 
          r.result_data && r.result_data.is_public === true
        );
        if (publicAccounts.length > 0) {
          riskScore += publicAccounts.length * 0.1;
          riskFactors.push(`${publicAccounts.length} public social media account(s)`);
        }
      }
      
      // Analyze personal information exposure
      const personalResults = results.filter(r => 
        r.result_type === 'personal_info' || r.result_type === 'metadata'
      );
      if (personalResults.length > 0) {
        riskScore += personalResults.length * 0.15;
        riskFactors.push(`${personalResults.length} personal information exposure(s)`);
      }
      
      // Determine risk level
      let calculatedRiskLevel = 'low';
      if (riskScore >= 0.8) calculatedRiskLevel = 'critical';
      else if (riskScore >= 0.6) calculatedRiskLevel = 'high';
      else if (riskScore >= 0.4) calculatedRiskLevel = 'medium';
      else if (riskScore >= 0.2) calculatedRiskLevel = 'low';
      
      return {
        riskScore: Math.min(riskScore, 1.0),
        riskLevel: calculatedRiskLevel,
        riskFactors,
        totalFindings: results.length,
        breachCount: breachResults.length,
        socialExposure: socialResults.length,
        personalExposure: personalResults.length
      };
    } catch (error) {
      logger.error('Failed to assess risk:', error);
      throw error;
    }
  }

  // Generate unique report ID
  generateReportId(targetIdentifier) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `report_${targetIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
  }

  // Generate recommendations based on findings
  async generateRecommendations(targetIdentifier, riskAssessment = null) {
    try {
      const results = await this.getResultsForTarget(targetIdentifier);
      const recommendations = [];
      
      // Check for data breaches
      const breachResults = results.filter(r => r.result_type === 'breach');
      if (breachResults.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'security',
          title: 'Data Breach Response',
          description: `Found in ${breachResults.length} data breach(es). Consider changing passwords and enabling two-factor authentication.`,
          actions: [
            'Change passwords for affected accounts',
            'Enable two-factor authentication',
            'Monitor financial accounts for suspicious activity',
            'Consider credit monitoring services'
          ]
        });
      }
      
      // Check for social media exposure
      const socialResults = results.filter(r => r.result_type === 'social_account');
      if (socialResults.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'privacy',
          title: 'Social Media Privacy Review',
          description: `Found ${socialResults.length} social media account(s). Review privacy settings and content.`,
          actions: [
            'Review privacy settings on all social media accounts',
            'Remove or secure sensitive personal information',
            'Consider using pseudonyms for online activities',
            'Regularly audit social media presence'
          ]
        });
      }
      
      // Check for personal information exposure
      const personalResults = results.filter(r => 
        r.result_type === 'personal_info' || r.result_type === 'metadata'
      );
      if (personalResults.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'privacy',
          title: 'Personal Information Protection',
          description: `Found ${personalResults.length} personal information exposure(s). Secure sensitive data.`,
          actions: [
            'Remove personal information from public sources',
            'Use privacy-focused search engines',
            'Consider data removal services',
            'Regularly audit online presence'
          ]
        });
      }
      
      // General recommendations
      recommendations.push({
        priority: 'low',
        category: 'maintenance',
        title: 'Ongoing Monitoring',
        description: 'Establish regular monitoring of your digital footprint.',
        actions: [
          'Set up regular OSINT searches',
          'Monitor for new data breaches',
          'Keep software and systems updated',
          'Educate yourself on privacy best practices'
        ]
      });
      
      return recommendations;
    } catch (error) {
      logger.error('Failed to generate recommendations:', error);
      throw error;
    }
  }

  // Generate report ID
  generateReportId(targetIdentifier) {
    const timestamp = Date.now();
    const hash = this.simpleHash(targetIdentifier + timestamp);
    return `report_${hash}_${timestamp}`;
  }

  // Simple hash function
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ===== ANALYTICS =====

  // Get OSINT analytics dashboard data
  async getAnalyticsDashboard(userId = null, timeRange = '30d') {
    try {
      const timeFilter = this.getTimeFilter(timeRange);
      
      // Get overall statistics
      const stats = await this.getOverallStats(timeFilter);
      
      // Get tool usage statistics
      const toolStats = await this.getToolUsageStats(timeFilter);
      
      // Get result type distribution
      const resultTypeStats = await this.getResultTypeStats(timeFilter);
      
      // Get user activity (if userId provided)
      const userActivity = userId ? await this.getUserActivity(userId, timeFilter) : null;
      
      // Get trending targets
      const trendingTargets = await this.getTrendingTargets(timeFilter);
      
      return {
        timeRange,
        generatedAt: new Date().toISOString(),
        overall: stats,
        tools: toolStats,
        resultTypes: resultTypeStats,
        userActivity,
        trending: trendingTargets
      };
    } catch (error) {
      logger.error('Failed to get analytics dashboard:', error);
      throw error;
    }
  }

  // Get time filter for queries
  getTimeFilter(timeRange) {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return startDate;
  }

  // Get overall statistics
  async getOverallStats(startDate) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_results,
          COUNT(DISTINCT target_identifier) as unique_targets,
          COUNT(DISTINCT search_session_id) as total_searches,
          COUNT(DISTINCT tool_name) as tools_used,
          AVG(confidence_score) as avg_confidence
        FROM osint_results
        WHERE discovered_at >= $1
      `;
      
      const result = await postgresPool.query(query, [startDate]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get overall stats:', error);
      throw error;
    }
  }

  // Get tool usage statistics
  async getToolUsageStats(startDate) {
    try {
      const query = `
        SELECT 
          tool_name,
          COUNT(*) as usage_count,
          AVG(confidence_score) as avg_confidence,
          COUNT(DISTINCT target_identifier) as unique_targets
        FROM osint_results
        WHERE discovered_at >= $1
        GROUP BY tool_name
        ORDER BY usage_count DESC
      `;
      
      const result = await postgresPool.query(query, [startDate]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get tool usage stats:', error);
      throw error;
    }
  }

  // Get result type statistics
  async getResultTypeStats(startDate) {
    try {
      const query = `
        SELECT 
          result_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM osint_results
        WHERE discovered_at >= $1
        GROUP BY result_type
        ORDER BY count DESC
      `;
      
      const result = await postgresPool.query(query, [startDate]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get result type stats:', error);
      throw error;
    }
  }

  // Get user activity
  async getUserActivity(userId, startDate) {
    try {
      const query = `
        SELECT 
          DATE(ss.created_at) as date,
          COUNT(*) as searches,
          COUNT(DISTINCT ss.id) as unique_sessions
        FROM search_sessions ss
        WHERE ss.user_id = $1 AND ss.created_at >= $2
        GROUP BY DATE(ss.created_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      
      const result = await postgresPool.query(query, [userId, startDate]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get user activity:', error);
      throw error;
    }
  }

  // Get trending targets
  async getTrendingTargets(startDate) {
    try {
      const query = `
        SELECT 
          target_identifier,
          COUNT(*) as result_count,
          COUNT(DISTINCT tool_name) as tools_used,
          MAX(discovered_at) as last_seen
        FROM osint_results
        WHERE discovered_at >= $1
        GROUP BY target_identifier
        HAVING COUNT(*) > 1
        ORDER BY result_count DESC, last_seen DESC
        LIMIT 10
      `;
      
      const result = await postgresPool.query(query, [startDate]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get trending targets:', error);
      throw error;
    }
  }
}

module.exports = OSINTAnalyticsService;
