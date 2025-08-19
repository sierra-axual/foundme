const axios = require('axios');
const { logger } = require('../config/database');

class ReconFTWService {
    constructor() {
        // Change from business OSINT to people OSINT
        this.apiBaseUrl = 'http://reconftw:5000';
        
        // People-focused tools instead of business tools
        this.tools = {
            sherlock: 'sherlock',
            theharvester: 'theharvester', 
            holehe: 'holehe',
            h8mail: 'h8mail',
            maigret: 'maigret'
        };
        
        // Rate limits for people OSINT tools
        this.rateLimits = {
            sherlock: { calls: 0, maxCalls: 50, resetTime: Date.now() + 3600000 },
            theharvester: { calls: 0, maxCalls: 30, resetTime: Date.now() + 3600000 },
            holehe: { calls: 0, maxCalls: 100, resetTime: Date.now() + 3600000 },
            h8mail: { calls: 0, maxCalls: 20, resetTime: Date.now() + 3600000 },
            maigret: { calls: 0, maxCalls: 60, resetTime: Date.now() + 3600000 }
        };
        
        // Check tool availability on initialization
        this.checkToolAvailability();
  }

  // Check which people OSINT tools are available via HTTP API
  async checkToolAvailability() {
    try {
      logger.info(`Checking People OSINT tool availability via API: ${this.apiBaseUrl}`);
      
      const response = await axios.get(`${this.apiBaseUrl}/tools/status`, {
        timeout: 10000 // 10 seconds
      });
      
      this.availableTools = response.data;
      
      const availableToolNames = Object.keys(this.availableTools)
        .filter(toolName => this.availableTools[toolName].available);
      
      logger.info(`Available People OSINT tools: ${availableToolNames.join(', ')}`);
      
      return this.availableTools;
      
    } catch (error) {
      logger.error(`Failed to check tool availability: ${error.message}`);
      // Set all tools as unavailable if API is not reachable
      this.availableTools = {};
      for (const toolName of Object.keys(this.tools)) {
        this.availableTools[toolName] = {
          available: false,
          error: `API unreachable: ${error.message}`
        };
      }
      
      return this.availableTools;
    }
  }

  // Check rate limits before executing tools
  checkRateLimit(toolName) {
    const limit = this.rateLimits[toolName];
    if (!limit) return true;

    // Reset counter if time has passed
    if (Date.now() > limit.resetTime) {
      limit.calls = 0;
      limit.resetTime = Date.now() + 3600000;
    }

    if (limit.calls >= limit.maxCalls) {
      throw new Error(`Rate limit exceeded for ${toolName}. Please try again later.`);
    }

    limit.calls++;
    return true;
  }

  // Execute tool via HTTP API
  async executeTool(toolName, params, options = {}) {
    try {
      // Check if tool is available
      if (!this.availableTools[toolName] || !this.availableTools[toolName].available) {
        return { 
          success: false, 
          error: `Tool ${toolName} is not available`, 
          tool: toolName 
        };
      }
      
      this.checkRateLimit(toolName);
      
      logger.info(`Executing ${toolName} via API with params:`, params);
      
      const response = await axios.post(`${this.apiBaseUrl}/tools/${toolName}/execute`, params, {
        timeout: options.timeout || 300000 // 5 minutes default
      });
      
      return response.data;
      
    } catch (error) {
      logger.error(`Error executing ${toolName}:`, error.message);
      return { success: false, error: error.message, tool: toolName };
    }
  }

      // Replace domain-focused methods with people-focused methods
    async searchPersonByUsername(username) {
        try {
            logger.info(`Starting username search for ${username} via People OSINT API`);
            
            const response = await axios.post(`${this.apiBaseUrl}/person/username-search`, {
                username: username
            }, {
                timeout: 300000 // 5 minutes
            });
            
            if (response.data.success) {
                logger.info(`Found ${response.data.total_found} social accounts for username ${username}`);
                return response.data;
            } else {
                logger.error(`Username search API failed: ${response.data.error}`);
                return {
                    success: false,
                    error: response.data.error
                };
            }
            
        } catch (error) {
            logger.error(`Username search failed for ${username}:`, error.message);
            throw error;
        }
    }

    async searchPersonByEmail(email) {
        try {
            logger.info(`Starting email investigation for ${email} via People OSINT API`);
            
            const response = await axios.post(`${this.apiBaseUrl}/person/email-search`, {
                email: email
            }, {
                timeout: 180000 // 3 minutes
            });
            
            if (response.data.success) {
                logger.info(`Email investigation completed for ${email}`);
                return response.data;
            } else {
                logger.error(`Email search API failed: ${response.data.error}`);
                return {
                    success: false,
                    error: response.data.error
                };
            }
            
        } catch (error) {
            logger.error(`Email search failed for ${email}:`, error.message);
            throw error;
        }
    }

    async searchPersonByPhone(phone) {
        try {
            logger.info(`Starting phone investigation for ${phone} via People OSINT API`);
            
            const response = await axios.post(`${this.apiBaseUrl}/person/phone-search`, {
                phone: phone
            }, {
                timeout: 120000 // 2 minutes
            });
            
            if (response.data.success) {
                logger.info(`Phone investigation completed for ${phone}`);
                return response.data;
            } else {
                logger.error(`Phone search API failed: ${response.data.error}`);
                return {
                    success: false,
                    error: response.data.error
                };
            }
            
        } catch (error) {
            logger.error(`Phone search failed for ${phone}:`, error.message);
            throw error;
        }
    }

    async getFullPersonProfile(identifiers) {
        try {
            logger.info(`Starting full person profile investigation via People OSINT API`);
            
            const response = await axios.post(`${this.apiBaseUrl}/person/full-profile`, {
                identifiers: identifiers
            }, {
                timeout: 600000 // 10 minutes for comprehensive search
            });
            
            if (response.data.success) {
                logger.info(`Full person profile investigation completed`);
                return response.data;
            } else {
                logger.error(`Full profile search API failed: ${response.data.error}`);
                return {
                    success: false,
                    error: response.data.error
                };
            }
            
        } catch (error) {
            logger.error(`Full profile search failed:`, error.message);
            throw error;
        }
    }

    // Legacy method for backward compatibility (now redirects to people search)
    async discoverSubdomains(domain) {
        logger.warn('discoverSubdomains called - this method is deprecated for people tracking platform. Use searchPersonByUsername instead.');
        return {
            error: "This method is deprecated. Use people-focused search methods instead.",
            suggestion: "Use searchPersonByUsername(), searchPersonByEmail(), or searchPersonByPhone()",
            deprecated: true
        };
    }

  // Get tool status and availability information
  async getToolStatus() {
    try {
      // Get fresh status from API
      await this.checkToolAvailability();
      return this.availableTools;
    } catch (error) {
      logger.error('Failed to get tool status:', error);
      return {};
    }
  }
}

module.exports = ReconFTWService;
