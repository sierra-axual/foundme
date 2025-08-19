const { logger } = require('../config/database');
const SearchSession = require('../models/SearchSession');
const OSINTResult = require('../models/OSINTResult');
const User = require('../models/User');
const ReconFTWService = require('./reconftwService');

class OSINTDataService {
  constructor() {
    this.reconftwService = new ReconFTWService();
  }

  // Create a new search session and execute OSINT search
  async createSearchSession(userId, searchData) {
    try {
      const { search_type, target_identifier, session_name, metadata = {} } = searchData;
      
      // Check if user has search quota
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const quota = await user.hasSearchQuota();
      if (!quota.canSearch) {
        throw new Error(`Search quota exceeded. Daily: ${quota.daily.used}/${quota.daily.limit}, Monthly: ${quota.monthly.used}/${quota.monthly.limit}`);
      }

      // Create search session
      const session = await SearchSession.create({
        user_id: userId,
        session_name: session_name || `${search_type} search for ${target_identifier}`,
        search_type,
        metadata: {
          ...metadata,
          target_identifier,
          created_at: new Date().toISOString()
        }
      });

      logger.info(`Created search session ${session.id} for user ${userId}`);

      // Execute the search asynchronously
      this.executeSearch(session, target_identifier, search_type).catch(error => {
        logger.error(`Search execution failed for session ${session.id}:`, error);
        session.markFailed(error.message).catch(logger.error);
      });

      return session;
    } catch (error) {
      logger.error('Failed to create search session:', error);
      throw error;
    }
  }

  // Execute OSINT search based on type
  async executeSearch(session, targetIdentifier, searchType) {
    try {
      logger.info(`Starting ${searchType} search for ${targetIdentifier} in session ${session.id}`);
      
      // Mark session as running
      await session.markStarted();

      let results = [];
      let totalResults = 0;

      switch (searchType) {
        case 'username':
          results = await this.executeUsernameSearch(session, targetIdentifier);
          break;
        case 'email':
          results = await this.executeEmailSearch(session, targetIdentifier);
          break;
        case 'phone':
          results = await this.executePhoneSearch(session, targetIdentifier);
          break;
        case 'full_profile':
          results = await this.executeFullProfileSearch(session, targetIdentifier);
          break;
        default:
          throw new Error(`Unsupported search type: ${searchType}`);
      }

      // Store results in database
      if (results.length > 0) {
        const osintResults = await this.storeOSINTResults(session.id, results);
        totalResults = osintResults.length;
        logger.info(`Stored ${totalResults} OSINT results for session ${session.id}`);
      }

      // Mark session as completed
      await session.markCompleted(totalResults);

      logger.info(`Search completed for session ${session.id} with ${totalResults} results`);
      return results;

    } catch (error) {
      logger.error(`Search execution failed for session ${session.id}:`, error);
      await session.markFailed(error.message);
      throw error;
    }
  }

  // Execute username search using Sherlock and Maigret
  async executeUsernameSearch(session, username) {
    const results = [];
    
    try {
      // Search with Sherlock
      const sherlockResult = await this.reconftwService.searchPersonByUsername(username);
      if (sherlockResult.success) {
        results.push({
          target_identifier: username,
          target_type: 'username',
          tool_name: 'sherlock',
          result_type: 'social_account',
          result_data: sherlockResult,
          confidence_score: 0.8,
          tags: ['social_media', 'username_enumeration']
        });
      }

      // Search with Maigret (if available)
      try {
        const maigretResult = await this.reconftwService.executeTool('maigret', [username]);
        if (maigretResult.success) {
          results.push({
            target_identifier: username,
            target_type: 'username',
            tool_name: 'maigret',
            result_type: 'social_account',
            result_data: maigretResult,
            confidence_score: 0.7,
            tags: ['social_media', 'username_enumeration']
          });
        }
      } catch (error) {
        logger.warn(`Maigret search failed for ${username}:`, error.message);
      }

    } catch (error) {
      logger.error(`Username search failed for ${username}:`, error);
      throw error;
    }

    return results;
  }

  // Execute email search using Holehe, H8mail, and theHarvester
  async executeEmailSearch(session, email) {
    const results = [];
    
    try {
      // Search with Holehe
      try {
        const holeheResult = await this.reconftwService.executeTool('holehe', [email]);
        if (holeheResult.success) {
          results.push({
            target_identifier: email,
            target_type: 'email',
            tool_name: 'holehe',
            result_type: 'metadata',
            result_data: holeheResult,
            confidence_score: 0.9,
            tags: ['email_verification', 'account_check']
          });
        }
      } catch (error) {
        logger.warn(`Holehe search failed for ${email}:`, error.message);
      }

      // Search with H8mail
      try {
        const h8mailResult = await this.reconftwService.executeTool('h8mail', [email]);
        if (h8mailResult.success) {
          results.push({
            target_identifier: email,
            target_type: 'email',
            tool_name: 'h8mail',
            result_type: 'breach',
            result_data: h8mailResult,
            confidence_score: 0.85,
            tags: ['data_breach', 'password_hunting']
          });
        }
      } catch (error) {
        logger.warn(`H8mail search failed for ${email}:`, error.message);
      }

      // Search with theHarvester
      try {
        const theharvesterResult = await this.reconftwService.executeTool('theharvester', ['-d', email, '-b', 'all']);
        if (theharvesterResult.success) {
          results.push({
            target_identifier: email,
            target_type: 'email',
            tool_name: 'theharvester',
            result_type: 'metadata',
            result_data: theharvesterResult,
            confidence_score: 0.7,
            tags: ['email_harvesting', 'information_gathering']
          });
        }
      } catch (error) {
        logger.warn(`theHarvester search failed for ${email}:`, error.message);
      }

    } catch (error) {
      logger.error(`Email search failed for ${email}:`, error);
      throw error;
    }

    return results;
  }

  // Execute phone search (placeholder for future implementation)
  async executePhoneSearch(session, phone) {
    // Phone search is not yet implemented
    logger.info(`Phone search not yet implemented for ${phone}`);
    return [];
  }

  // Execute full profile search combining multiple identifiers
  async executeFullProfileSearch(session, identifiers) {
    const results = [];
    const { username, email, phone } = identifiers;
    
    try {
      // Search by username if provided
      if (username) {
        const usernameResults = await this.executeUsernameSearch(session, username);
        results.push(...usernameResults);
      }

      // Search by email if provided
      if (email) {
        const emailResults = await this.executeEmailSearch(session, email);
        results.push(...emailResults);
      }

      // Search by phone if provided
      if (phone) {
        const phoneResults = await this.executePhoneSearch(session, phone);
        results.push(...phoneResults);
      }

    } catch (error) {
      logger.error(`Full profile search failed:`, error);
      throw error;
    }

    return results;
  }

  // Store OSINT results in database
  async storeOSINTResults(sessionId, results) {
    try {
      const resultsWithSession = results.map(result => ({
        ...result,
        search_session_id: sessionId
      }));

      const storedResults = await OSINTResult.createBatch(resultsWithSession);
      logger.info(`Stored ${storedResults.length} OSINT results for session ${sessionId}`);
      
      return storedResults;
    } catch (error) {
      logger.error(`Failed to store OSINT results for session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get search session with results
  async getSearchSession(sessionId, userId = null) {
    try {
      const session = await SearchSession.findById(sessionId);
      if (!session) {
        throw new Error('Search session not found');
      }

      // Check if user has access to this session
      if (userId && session.user_id !== userId) {
        throw new Error('Access denied to this search session');
      }

      // Get session results
      const results = await session.getResults();
      const summary = await session.getSummary();

      return {
        session,
        results,
        summary
      };
    } catch (error) {
      logger.error(`Failed to get search session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get user's search history
  async getUserSearchHistory(userId, limit = 50, offset = 0) {
    try {
      const sessions = await SearchSession.findByUserId(userId, limit, offset);
      
      // Get summary for each session
      const sessionsWithSummary = await Promise.all(
        sessions.map(async (session) => {
          const summary = await session.getSummary();
          return {
            ...session,
            summary
          };
        })
      );

      return sessionsWithSummary;
    } catch (error) {
      logger.error(`Failed to get search history for user ${userId}:`, error);
      throw error;
    }
  }

  // Search OSINT results by criteria
  async searchOSINTResults(criteria, userId = null, limit = 100, offset = 0) {
    try {
      // Add user filter if provided
      if (userId) {
        const userSessions = await SearchSession.findByUserId(userId);
        const sessionIds = userSessions.map(s => s.id);
        criteria.search_session_id = sessionIds;
      }

      const results = await OSINTResult.search(criteria, limit, offset);
      return results;
    } catch (error) {
      logger.error('Failed to search OSINT results:', error);
      throw error;
    }
  }

  // Get OSINT statistics
  async getOSINTStats(userId = null, criteria = {}) {
    try {
      if (userId) {
        const userSessions = await SearchSession.findByUserId(userId);
        const sessionIds = userSessions.map(s => s.id);
        criteria.search_session_id = sessionIds;
      }

      const [resultStats, sessionStats] = await Promise.all([
        OSINTResult.getStats(criteria),
        SearchSession.getUserStats(userId)
      ]);

      return {
        results: resultStats,
        sessions: sessionStats
      };
    } catch (error) {
      logger.error('Failed to get OSINT statistics:', error);
      throw error;
    }
  }

  // Export search results
  async exportSearchResults(sessionId, format = 'json', userId = null) {
    try {
      const { session, results } = await this.getSearchSession(sessionId, userId);
      
      switch (format.toLowerCase()) {
        case 'json':
          return {
            format: 'json',
            data: {
              session: session,
              results: results,
              export_date: new Date().toISOString()
            }
          };
        
        case 'csv':
          const csvData = this.convertToCSV(results);
          return {
            format: 'csv',
            data: csvData,
            filename: `osint_results_${sessionId}_${new Date().toISOString().split('T')[0]}.csv`
          };
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error(`Failed to export search results for session ${sessionId}:`, error);
      throw error;
    }
  }

  // Convert results to CSV format
  convertToCSV(results) {
    if (results.length === 0) {
      return '';
    }

    const headers = [
      'ID', 'Target Identifier', 'Target Type', 'Tool Name', 'Result Type',
      'Confidence Score', 'Source URL', 'Discovered At', 'Is Verified', 'Tags'
    ];

    const rows = results.map(result => [
      result.id,
      result.target_identifier,
      result.target_type,
      result.tool_name,
      result.result_type,
      result.confidence_score,
      result.source_url || '',
      result.discovered_at,
      result.is_verified ? 'Yes' : 'No',
      (result.tags || []).join('; ')
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  // Clean up old search sessions and results
  async cleanupOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Find old sessions
      const oldSessions = await SearchSession.search({
        date_to: cutoffDate
      });

      let deletedSessions = 0;
      let deletedResults = 0;

      for (const session of oldSessions) {
        try {
          await session.delete();
          deletedSessions++;
        } catch (error) {
          logger.warn(`Failed to delete old session ${session.id}:`, error.message);
        }
      }

      logger.info(`Cleanup completed: ${deletedSessions} sessions deleted`);
      return { deletedSessions, deletedResults };
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
      throw error;
    }
  }
}

module.exports = OSINTDataService;
