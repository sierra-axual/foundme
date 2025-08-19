const { chromium } = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');
const { postgresPool, redisClient, logger } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DiscoveryService {
  constructor() {
    this.browser = null;
    this.maxConcurrentScans = 3;
    this.scanTimeout = 300000; // 5 minutes
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
  }

  // Initialize browser instance
  async initializeBrowser() {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        logger.info('Playwright browser initialized successfully');
      }
      return this.browser;
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  // Start a new OSINT discovery scan
  async startDiscoveryScan(scanData) {
    const {
      userId,
      targetType, // 'person', 'company', 'domain', 'email'
      targetValue,
      scanDepth = 'basic', // 'basic', 'comprehensive', 'deep'
      includeSocialMedia = true,
      includeDarkWeb = false,
      includeMetadata = true
    } = scanData;

    // Map target types to database schema values
    const targetTypeMap = {
      'person': 'name',
      'company': 'company',
      'domain': 'domain',
      'email': 'email'
    };

    const dbTargetType = targetTypeMap[targetType] || 'name';
    
    logger.info('Target type mapping:', { original: targetType, mapped: dbTargetType });

    // Update scanData with mapped target type
    scanData.targetType = dbTargetType;

    try {
      // Create scan record
      const scanId = await this.createScanRecord({
        userId,
        targetType: dbTargetType, // Use mapped target type
        targetValue,
        scanDepth,
        includeSocialMedia,
        includeDarkWeb,
        includeMetadata
      });

      // Start scan in background
      this.runDiscoveryScan(scanId, scanData).catch(error => {
        logger.error(`Scan ${scanId} failed:`, error);
      });

      return {
        success: true,
        scanId,
        message: 'Discovery scan started successfully',
        estimatedDuration: this.getEstimatedDuration(scanDepth)
      };

    } catch (error) {
      logger.error('Failed to start discovery scan:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Run the actual discovery scan
  async runDiscoveryScan(scanId, scanData) {
    const startTime = Date.now();
    
    try {
      // Update scan status
      await this.updateScanStatus(scanId, 'running');

      // Initialize browser if needed
      await this.initializeBrowser();

      // Collect data based on target type
      let results = {};
      
      switch (scanData.targetType) {
        case 'person':
          results = await this.scanPerson(scanData);
          break;
        case 'company':
          results = await this.scanCompany(scanData);
          break;
        case 'domain':
          results = await this.scanDomain(scanData);
          break;
        case 'email':
          results = await this.scanEmail(scanData);
          break;
        default:
          throw new Error(`Unsupported target type: ${scanData.targetType}`);
      }

      // Store results
      await this.storeScanResults(scanId, results);

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(results);

      // Update scan status
      await this.updateScanStatus(scanId, 'completed', {
        riskScore,
        duration: Date.now() - startTime,
        findingsCount: this.countFindings(results)
      });

      logger.info(`Scan ${scanId} completed successfully`, { riskScore, duration: Date.now() - startTime });

    } catch (error) {
      logger.error(`Scan ${scanId} failed:`, error);
      await this.updateScanStatus(scanId, 'failed', { error: error.message });
    }
  }

  // Scan for person-related information
  async scanPerson(scanData) {
    const { targetValue, includeSocialMedia, includeMetadata } = scanData;
    const results = {
      socialMedia: {},
      professional: {},
      publicRecords: {},
      metadata: {}
    };

    try {
      // Social media discovery
      if (includeSocialMedia) {
        results.socialMedia = await this.discoverSocialMediaAccounts(targetValue);
      }

      // Professional information
      results.professional = await this.discoverProfessionalInfo(targetValue);

      // Public records
      results.publicRecords = await this.discoverPublicRecords(targetValue);

      // Metadata extraction (if files/images found)
      if (includeMetadata) {
        results.metadata = await this.extractMetadata(targetValue);
      }

    } catch (error) {
      logger.error('Person scan failed:', error);
    }

    return results;
  }

  // Scan for company-related information
  async scanCompany(scanData) {
    const { targetValue, includeMetadata } = scanData;
    const results = {
      companyInfo: {},
      socialMedia: {},
      employees: [],
      news: [],
      financial: {},
      metadata: {}
    };

    try {
      // Company information
      results.companyInfo = await this.discoverCompanyInfo(targetValue);

      // Company social media
      results.socialMedia = await this.discoverCompanySocialMedia(targetValue);

      // Employee information
      results.employees = await this.discoverEmployees(targetValue);

      // News and mentions
      results.news = await this.discoverCompanyNews(targetValue);

      // Financial information
      results.financial = await this.discoverFinancialInfo(targetValue);

      // Metadata extraction
      if (includeMetadata) {
        results.metadata = await this.extractMetadata(targetValue);
      }

    } catch (error) {
      logger.error('Company scan failed:', error);
    }

    return results;
  }

  // Scan for domain-related information
  async scanDomain(scanData) {
    const { targetValue, includeMetadata } = scanData;
    const results = {
      domainInfo: {},
      subdomains: [],
      technologies: [],
      security: {},
      metadata: {}
    };

    try {
      // Domain information
      results.domainInfo = await this.discoverDomainInfo(targetValue);

      // Subdomain discovery
      results.subdomains = await this.discoverSubdomains(targetValue);

      // Technology stack
      results.technologies = await this.discoverTechnologies(targetValue);

      // Security information
      results.security = await this.discoverSecurityInfo(targetValue);

      // Metadata extraction
      if (includeMetadata) {
        results.metadata = await this.extractMetadata(targetValue);
      }

    } catch (error) {
      logger.error('Domain scan failed:', error);
    }

    return results;
  }

  // Scan for email-related information
  async scanEmail(scanData) {
    const { targetValue, includeDarkWeb } = scanData;
    const results = {
      emailInfo: {},
      breaches: [],
      socialMedia: {},
      darkWeb: {},
      metadata: {}
    };

    try {
      // Email information
      results.emailInfo = await this.discoverEmailInfo(targetValue);

      // Data breaches
      results.breaches = await this.discoverDataBreaches(targetValue);

      // Social media accounts
      results.socialMedia = await this.discoverSocialMediaAccounts(targetValue);

      // Dark web mentions
      if (includeDarkWeb) {
        results.darkWeb = await this.discoverDarkWebMentions(targetValue);
      }

    } catch (error) {
      logger.error('Email scan failed:', error);
    }

    return results;
  }

  // Discover social media accounts
  async discoverSocialMediaAccounts(targetValue) {
    const socialPlatforms = [
      { name: 'LinkedIn', url: 'https://www.linkedin.com/in/', selector: '.profile-picture' },
      { name: 'Twitter', url: 'https://twitter.com/', selector: '[data-testid="UserName"]' },
      { name: 'Facebook', url: 'https://www.facebook.com/', selector: '[data-testid="page_title"]' },
      { name: 'Instagram', url: 'https://www.instagram.com/', selector: 'h1' },
      { name: 'GitHub', url: 'https://github.com/', selector: '.vcard-names' }
    ];

    const results = {};

    for (const platform of socialPlatforms) {
      try {
        const accountInfo = await this.checkSocialMediaAccount(platform, targetValue);
        if (accountInfo.exists) {
          results[platform.name] = accountInfo;
        }
      } catch (error) {
        logger.warn(`Failed to check ${platform.name}:`, error.message);
      }
    }

    return results;
  }

  // Check if a social media account exists
  async checkSocialMediaAccount(platform, username) {
    try {
      const page = await this.browser.newPage();
      
      // Set random user agent
      await page.setUserAgent(this.userAgents[Math.floor(Math.random() * this.userAgents.length)]);
      
      // Navigate to profile
      const profileUrl = `${platform.url}${username}`;
      await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Check if profile exists
      const exists = await page.$(platform.selector).then(el => !!el);
      
      if (exists) {
        // Extract profile information
        const profileData = await this.extractProfileData(page, platform);
        
        await page.close();
        return {
          exists: true,
          url: profileUrl,
          username,
          profileData
        };
      }

      await page.close();
      return { exists: false };

    } catch (error) {
      logger.error(`Failed to check ${platform.name} account:`, error);
      return { exists: false, error: error.message };
    }
  }

  // Extract profile data from social media page
  async extractProfileData(page, platform) {
    try {
      const profileData = {};

      switch (platform.name) {
        case 'LinkedIn':
          profileData.name = await page.$eval('h1', el => el.textContent?.trim()).catch(() => null);
          profileData.headline = await page.$eval('.text-body-medium', el => el.textContent?.trim()).catch(() => null);
          profileData.location = await page.$eval('.text-body-small', el => el.textContent?.trim()).catch(() => null);
          break;
        
        case 'Twitter':
          profileData.name = await page.$eval('[data-testid="UserName"]', el => el.textContent?.trim()).catch(() => null);
          profileData.handle = await page.$eval('[data-testid="UserName"] span', el => el.textContent?.trim()).catch(() => null);
          profileData.bio = await page.$eval('[data-testid="UserDescription"]', el => el.textContent?.trim()).catch(() => null);
          break;
        
        case 'GitHub':
          profileData.name = await page.$eval('.vcard-names .p-name', el => el.textContent?.trim()).catch(() => null);
          profileData.username = await page.$eval('.vcard-names .p-nickname', el => el.textContent?.trim()).catch(() => null);
          profileData.bio = await page.$eval('.user-profile-bio', el => el.textContent?.trim()).catch(() => null);
          break;
      }

      return profileData;

    } catch (error) {
      logger.error('Failed to extract profile data:', error);
      return {};
    }
  }

  // Discover professional information
  async discoverProfessionalInfo(targetValue) {
    const results = {
      companyInfo: [],
      jobTitles: [],
      skills: []
    };

    try {
      // Search for professional information on various platforms
      const searchQueries = [
        `${targetValue} professional`,
        `${targetValue} work experience`,
        `${targetValue} company`
      ];

      for (const query of searchQueries) {
        const searchResults = await this.searchGoogle(query);
        results.companyInfo.push(...searchResults);
      }

    } catch (error) {
      logger.error('Professional info discovery failed:', error);
    }

    return results;
  }

  // Discover public records
  async discoverPublicRecords(targetValue) {
    const results = {
      courtRecords: [],
      propertyRecords: [],
      businessRecords: []
    };

    try {
      // Search for public records
      const searchQueries = [
        `${targetValue} court records`,
        `${targetValue} property records`,
        `${targetValue} business records`
      ];

      for (const query of searchQueries) {
        const searchResults = await this.searchGoogle(query);
        // Filter and categorize results
        this.categorizePublicRecords(searchResults, results);
      }

    } catch (error) {
      logger.error('Public records discovery failed:', error);
    }

    return results;
  }

  // Search Google (basic implementation)
  async searchGoogle(query) {
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent(this.userAgents[Math.floor(Math.random() * this.userAgents.length)]);
      
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Extract search results
      const results = await page.evaluate(() => {
        const searchResults = [];
        const resultElements = document.querySelectorAll('.g');
        
        resultElements.forEach((element, index) => {
          if (index < 10) { // Limit to first 10 results
            const titleElement = element.querySelector('h3');
            const linkElement = element.querySelector('a');
            const snippetElement = element.querySelector('.VwiC3b');
            
            if (titleElement && linkElement) {
              searchResults.push({
                title: titleElement.textContent?.trim(),
                url: linkElement.href,
                snippet: snippetElement?.textContent?.trim() || ''
              });
            }
          }
        });
        
        return searchResults;
      });

      await page.close();
      return results;

    } catch (error) {
      logger.error('Google search failed:', error);
      return [];
    }
  }

  // Categorize public records
  categorizePublicRecords(searchResults, results) {
    searchResults.forEach(result => {
      const { title, url, snippet } = result;
      const text = `${title} ${snippet}`.toLowerCase();

      if (text.includes('court') || text.includes('legal') || text.includes('case')) {
        results.courtRecords.push(result);
      } else if (text.includes('property') || text.includes('real estate') || text.includes('deed')) {
        results.propertyRecords.push(result);
      } else if (text.includes('business') || text.includes('company') || text.includes('corporate')) {
        results.businessRecords.push(result);
      }
    });
  }

  // Extract metadata from found content
  async extractMetadata(targetValue) {
    const results = {
      images: [],
      documents: [],
      links: []
    };

    try {
      // Search for images and documents
      const searchQueries = [
        `${targetValue} filetype:pdf`,
        `${targetValue} filetype:doc`,
        `${targetValue} image`
      ];

      for (const query of searchQueries) {
        const searchResults = await this.searchGoogle(query);
        this.categorizeMetadata(searchResults, results);
      }

    } catch (error) {
      logger.error('Metadata extraction failed:', error);
    }

    return results;
  }

  // Categorize metadata
  categorizeMetadata(searchResults, results) {
    searchResults.forEach(result => {
      const { url, title } = result;
      
      if (url.match(/\.(pdf|doc|docx)$/i)) {
        results.documents.push(result);
      } else if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
        results.images.push(result);
      } else {
        results.links.push(result);
      }
    });
  }

  // Calculate risk score based on findings
  async calculateRiskScore(results) {
    let riskScore = 0;
    let riskFactors = [];

    try {
      // Social media exposure
      const socialMediaCount = Object.keys(results.socialMedia || {}).length;
      if (socialMediaCount > 5) {
        riskScore += 20;
        riskFactors.push('High social media presence');
      } else if (socialMediaCount > 2) {
        riskScore += 10;
        riskFactors.push('Moderate social media presence');
      }

      // Public records exposure
      const publicRecordsCount = Object.values(results.publicRecords || {}).reduce((sum, arr) => sum + arr.length, 0);
      if (publicRecordsCount > 10) {
        riskScore += 25;
        riskFactors.push('Extensive public records');
      } else if (publicRecordsCount > 5) {
        riskScore += 15;
        riskFactors.push('Moderate public records');
      }

      // Professional information exposure
      const professionalCount = Object.values(results.professional || {}).reduce((sum, arr) => sum + arr.length, 0);
      if (professionalCount > 15) {
        riskScore += 20;
        riskFactors.push('High professional exposure');
      } else if (professionalCount > 8) {
        riskScore += 12;
        riskFactors.push('Moderate professional exposure');
      }

      // Metadata exposure
      const metadataCount = Object.values(results.metadata || {}).reduce((sum, arr) => sum + arr.length, 0);
      if (metadataCount > 20) {
        riskScore += 15;
        riskFactors.push('High metadata exposure');
      } else if (metadataCount > 10) {
        riskScore += 8;
        riskFactors.push('Moderate metadata exposure');
      }

      // Cap risk score at 100
      riskScore = Math.min(riskScore, 100);

    } catch (error) {
      logger.error('Risk score calculation failed:', error);
      riskScore = 50; // Default risk score
    }

    return {
      score: riskScore,
      factors: riskFactors,
      level: this.getRiskLevel(riskScore)
    };
  }

  // Get risk level based on score
  getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  // Count total findings
  countFindings(results) {
    let count = 0;
    Object.values(results).forEach(category => {
      if (Array.isArray(category)) {
        count += category.length;
      } else if (typeof category === 'object') {
        count += Object.values(category).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      }
    });
    return count;
  }

  // Get estimated scan duration
  getEstimatedDuration(scanDepth) {
    switch (scanDepth) {
      case 'basic': return '5-10 minutes';
      case 'comprehensive': return '15-25 minutes';
      case 'deep': return '30-45 minutes';
      default: return '10-15 minutes';
    }
  }

  // Create scan record in database
  async createScanRecord(scanData) {
    const query = `
      INSERT INTO osint_scans (
        id, user_id, target_type, target, scan_type, 
        priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `;

    const values = [
      uuidv4(),
      scanData.userId,
      scanData.targetType,
      scanData.targetValue,
      'comprehensive', // Default scan type
      'medium', // Default priority
      'queued' // Default status
    ];

    const result = await postgresPool.query(query, values);
    return result.rows[0].id;
  }

  // Update scan status
  async updateScanStatus(scanId, status, metadata = {}) {
    let query = `
      UPDATE osint_scans 
      SET status = $1, updated_at = NOW()
    `;
    
    const values = [status, scanId];
    let paramCount = 2;

    if (metadata.riskScore) {
      query += `, results = jsonb_set(COALESCE(results, '{}'), '{risk_score}', $${++paramCount})`;
      values.push(metadata.riskScore);
    }
    
    if (metadata.duration) {
      query += `, results = jsonb_set(COALESCE(results, '{}'), '{duration_ms}', $${++paramCount})`;
      values.push(metadata.duration);
    }
    
    if (metadata.findingsCount) {
      query += `, results = jsonb_set(COALESCE(results, '{}'), '{findings_count}', $${++paramCount})`;
      values.push(metadata.findingsCount);
    }
    
    if (metadata.error) {
      query += `, error_message = $${++paramCount}`;
      values.push(metadata.error);
    }

    if (status === 'running') {
      query += `, started_at = NOW()`;
    } else if (status === 'completed' || status === 'failed') {
      query += `, completed_at = NOW()`;
    }

    query += ` WHERE id = $2`;

    await postgresPool.query(query, values);
  }

  // Store scan results
  async storeScanResults(scanId, results) {
    try {
      // Store social media findings
      if (results.socialMedia) {
        await this.storeSocialMediaFindings(scanId, results.socialMedia);
      }

      // Store other findings
      await this.storeGeneralFindings(scanId, results);

    } catch (error) {
      logger.error('Failed to store scan results:', error);
    }
  }

  // Store social media findings
  async storeSocialMediaFindings(scanId, socialMedia) {
    for (const [platform, data] of Object.entries(socialMedia)) {
      if (data.exists) {
        const query = `
          INSERT INTO social_media_accounts (
            scan_id, platform, username, display_name, profile_url, bio, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        await postgresPool.query(query, [
          scanId,
          platform,
          data.username,
          data.profileData?.name || null,
          data.url,
          data.profileData?.bio || null,
          JSON.stringify(data.profileData)
        ]);
      }
    }
  }

  // Store general findings
  async storeGeneralFindings(scanId, results) {
    // Store scan results summary
    const query = `
      INSERT INTO scan_results (
        scan_id, result_type, source, title, description, content, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await postgresPool.query(query, [
      scanId,
      'summary',
      'discovery_service',
      'OSINT Discovery Results',
      'Comprehensive OSINT discovery scan results',
      JSON.stringify(results),
      JSON.stringify({ timestamp: new Date().toISOString() })
    ]);
  }

  // Get scan status
  async getScanStatus(scanId) {
    const query = `
      SELECT * FROM osint_scans WHERE id = $1
    `;

    const result = await postgresPool.query(query, [scanId]);
    return result.rows[0] || null;
  }

  // Get scan results
  async getScanResults(scanId) {
    const query = `
      SELECT * FROM scan_results WHERE scan_id = $1 ORDER BY created_at DESC
    `;

    const result = await postgresPool.query(query, [scanId]);
    return result.rows;
  }

  // Cleanup browser
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser cleanup completed');
    }
  }

  // Placeholder methods for company scanning
  async discoverCompanyInfo(companyName) {
    // TODO: Implement company information discovery
    logger.info(`Company info discovery for: ${companyName}`);
    return { name: companyName, status: 'pending' };
  }

  async discoverCompanySocialMedia(companyName) {
    // TODO: Implement company social media discovery
    logger.info(`Company social media discovery for: ${companyName}`);
    return {};
  }

  async discoverEmployees(companyName) {
    // TODO: Implement employee discovery
    logger.info(`Employee discovery for: ${companyName}`);
    return [];
  }

  async discoverCompanyNews(companyName) {
    // TODO: Implement company news discovery
    logger.info(`Company news discovery for: ${companyName}`);
    return [];
  }

  async discoverFinancialInfo(companyName) {
    // TODO: Implement financial information discovery
    logger.info(`Financial info discovery for: ${companyName}`);
    return {};
  }

  // Placeholder methods for domain scanning
  async discoverDomainInfo(domain) {
    // TODO: Implement domain information discovery
    logger.info(`Domain info discovery for: ${domain}`);
    return { domain, status: 'pending' };
  }

  async discoverSubdomains(domain) {
    // TODO: Implement subdomain discovery
    logger.info(`Subdomain discovery for: ${domain}`);
    return [];
  }

  async discoverTechnologies(domain) {
    // TODO: Implement technology stack discovery
    logger.info(`Technology discovery for: ${domain}`);
    return [];
  }

  async discoverSecurityInfo(domain) {
    // TODO: Implement security information discovery
    logger.info(`Security info discovery for: ${domain}`);
    return {};
  }

  // Placeholder methods for email scanning
  async discoverEmailInfo(email) {
    // TODO: Implement email information discovery
    logger.info(`Email info discovery for: ${email}`);
    return { email, status: 'pending' };
  }

  async discoverDataBreaches(email) {
    // TODO: Implement data breach discovery
    logger.info(`Data breach discovery for: ${email}`);
    return [];
  }

  async discoverDarkWebMentions(email) {
    // TODO: Implement dark web mention discovery
    logger.info(`Dark web mention discovery for: ${email}`);
    return {};
  }
}

module.exports = DiscoveryService;
