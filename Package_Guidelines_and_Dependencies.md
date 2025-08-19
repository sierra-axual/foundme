# 📦 Package Guidelines and Dependencies

## 🎯 **Core Principle: NO Deprecated NPM Modules**

**CRITICAL REQUIREMENT:** This project strictly prohibits the use of ANY deprecated npm modules. All packages must be actively maintained, secure, and follow modern best practices.

## ✅ **Approved Modern Packages**

### **Core Framework & Runtime**
- **Node.js:** `>=20.0.0` (LTS version)
- **Express:** `^4.18.0` (latest stable)
- **TypeScript:** `^5.0.0` (latest stable)

### **Authentication & Security**
- **JWT:** `jsonwebtoken` `^9.0.0`
- **Password Hashing:** `bcrypt` `^5.1.0`
- **Input Validation:** `zod` `^3.22.0`
- **CORS:** `cors` `^2.8.5`
- **Security Headers:** `helmet` `^7.0.0`
- **Rate Limiting:** `express-rate-limit` `^6.0.0`

### **Database & Caching**
- **PostgreSQL:** `pg` `^8.11.0`
- **Redis:** `redis` `^4.6.0`
- **Database Migrations:** Custom SQL-based system

### **Testing & Development**
- **Test Runner:** `vitest` `^0.34.0`
- **HTTP Testing:** `supertest` `^7.0.0`
- **Code Quality:** `eslint` `^9.0.0`
- **Development Server:** `nodemon` `^3.0.0`

### **Data Processing & Utilities**
- **UUID Generation:** `uuid` `^9.0.0`
- **Date Handling:** `dayjs` `^1.11.0`
- **File Uploads:** `multer` `^2.0.0-rc.3`
- **Image Processing:** `sharp` `^0.32.0`
- **Web Scraping:** `playwright` `^1.40.0`
- **HTTP Client:** `axios` `^1.6.0`
- **HTML Parsing:** `cheerio` `^1.0.0`

### **External Services**
- **Email:** `@sendgrid/mail` `^8.0.0`
- **SMS:** `twilio` `^4.19.0`
- **Logging:** `winston` `^3.11.0`

## 🚫 **Explicitly Banned Packages (Deprecated/Unsafe)**

### **Authentication & Security**
- `express-validator` → Use `zod` instead
- `joi` → Use `zod` instead
- `bcryptjs` → Use `bcrypt` instead
- `jsonwebtoken` → Use `jsonwebtoken` (latest version)
- `nanoid` → Use `uuid` instead

### **Testing & Development**
- `jest` → Use `vitest` instead
- `supertest` → Use `supertest` (latest version)
- `nodemon` → Use `nodemon` (latest version)

### **Data Processing**
- `moment` → Use `dayjs` instead
- `lodash` → Use native JavaScript methods
- `puppeteer` → Use `playwright` instead
- `nodemailer` → Use `@sendgrid/mail` instead
- `exif-parser` → Use `exifr` instead
- `pdf-parse` → Use `pdf2pic` instead
- `mammoth` → Remove (not needed)
- `xml2js` → Use `fast-xml-parser` instead

## 🔍 **OSINT Tool Integration (ReconFTW)**

### **System-Level Tools (Docker Container)**
- **Subdomain Discovery:** Amass, Subfinder, Assetfinder
- **Port Scanning:** Nmap, Naabu
- **Web Enumeration:** FFUF, Gobuster, Dirsearch
- **Vulnerability Scanning:** Nuclei, Vulners
- **DNS Intelligence:** DNSx, Shodan CLI
- **Certificate Transparency:** CTFR, Crt.sh
- **Historical Analysis:** Waybackurls
- **GitHub Reconnaissance:** GitDorks
- **Cloud Asset Discovery:** Cloudlist, S3Scanner

### **Integration Notes**
- All OSINT tools run in isolated Docker containers
- Tools are executed via subprocess calls from Node.js
- Output parsing is standardized to JSON format
- Rate limiting and ethical usage compliance enforced
- Results are aggregated and deduplicated automatically

## 🔒 **Package Security Requirements**

### **Pre-Installation Checks**
1. **Check package age:** Must be updated within last 6 months
2. **Verify maintenance:** GitHub stars, issues, PRs
3. **Security audit:** `npm audit` must pass
4. **License compatibility:** MIT, Apache 2.0, or similar
5. **Bundle size:** Minimize dependencies

### **Installation Commands**
```bash
# Always use exact versions for critical packages
npm install package@exact_version

# Check for deprecated packages
npm ls

# Security audit
npm audit

# Check package health
npm info package_name
```

### **Regular Maintenance**
- **Weekly:** `npm audit` and `npm outdated`
- **Monthly:** Update non-breaking dependencies
- **Quarterly:** Major version updates with testing
- **Immediate:** Security vulnerability patches

## 📋 **Package Selection Criteria**

### **Must Have:**
- ✅ Active maintenance (commits in last 3 months)
- ✅ Security-focused development
- ✅ Comprehensive testing coverage
- ✅ Clear documentation
- ✅ Active community support

### **Must NOT Have:**
- ❌ Deprecation warnings
- ❌ Security vulnerabilities
- ❌ Abandoned repositories
- ❌ Poor documentation
- ❌ Breaking changes without migration guides

## 🚨 **Violation Consequences**

**ANY use of deprecated packages will result in:**
1. Immediate removal and replacement
2. Code review failure
3. Build process blocking
4. Security audit failure

## 📚 **Resources & References**

- **npm Security:** https://docs.npmjs.com/about-audit-reports
- **Package Health:** https://snyk.io/advisor/
- **Security Advisories:** https://github.com/advisories
- **Deprecation Status:** https://www.npmjs.com/package/package-name

---

**Remember:** Quality over convenience. Every package choice impacts security, performance, and maintainability.
