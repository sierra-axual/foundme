# ReconFTW Service Fixes

## 🔍 **Issue Analysis**

The ReconFTW service test was failing because:

1. **Missing OSINT Tools**: The Docker container only had basic tools (nmap, whois, dig) but was missing specialized OSINT tools like subfinder, assetfinder, nuclei, etc.

2. **Missing Methods**: The `ReconFTWService` was missing the `discoverSubdomains()` method that the test endpoint was trying to call.

3. **Incomplete Tool Checking**: The tool availability checking was only looking for basic system tools, not the specialized OSINT tools.

## 🔧 **Fixes Applied**

### 1. **Updated ReconFTW Dockerfile** (`reconftw/Dockerfile`)
- **Added Go 1.21.6**: Required for building modern OSINT tools
- **Installed OSINT Tools**:
  - `subfinder` - Subdomain discovery
  - `assetfinder` - Asset discovery
  - `nuclei` - Vulnerability scanner
  - `dnsx` - DNS toolkit
  - `ffuf` - Web fuzzer
  - `gobuster` - Directory/file brute-forcer
  - `gitdorker` - GitHub reconnaissance
  - `s3scanner` - S3 bucket scanner
  - `ctfr` - Certificate transparency
- **Added Python Tools**: waybackpy, s3scanner, gitdorker
- **Created Wrapper Scripts**: For standardized tool output

### 2. **Enhanced ReconFTWService** (`backend/src/services/reconftwService.js`)
- **Added All OSINT Tools**: Updated tools registry with all required tools
- **Implemented Rate Limiting**: Appropriate limits for each tool type
- **Added `discoverSubdomains()` Method**: 
  - Uses subfinder and assetfinder
  - Combines and deduplicates results
  - Returns structured data format
- **Improved Tool Checking**: Better availability detection for all tool types
- **Enhanced Error Handling**: Detailed error reporting for missing tools

### 3. **Rate Limiting Configuration**
```javascript
// Core tools - higher limits
nmap: 20 calls/hour
whois: 100 calls/hour
dig: 100 calls/hour

// OSINT tools - security-focused limits
subfinder: 100 calls/hour
assetfinder: 50 calls/hour
nuclei: 200 calls/hour
s3scanner: 10 calls/hour (most restrictive)
```

## 🚀 **How to Apply Fixes**

### Option 1: Use the Rebuild Script (Recommended)
```powershell
# Windows PowerShell
.\scripts\rebuild-reconftw.ps1
```

### Option 2: Manual Rebuild
```bash
# Stop existing container
docker-compose -f docker-compose.simple.yml stop reconftw
docker-compose -f docker-compose.simple.yml rm -f reconftw

# Remove old image
docker rmi foundme-reconftw

# Build new image (takes 10-15 minutes)
docker build -t foundme-reconftw ./reconftw

# Start container
docker-compose -f docker-compose.simple.yml up -d reconftw
```

## 🧪 **Testing the Fixes**

After rebuilding, test the service:

```bash
# Test ReconFTW service
curl http://localhost:3001/test/reconftw

# Expected response format:
{
  "success": true,
  "message": "ReconFTW service test completed",
  "result": {
    "serviceInitialized": true,
    "toolStatus": {
      "subfinder": {"available": true},
      "assetfinder": {"available": true},
      "nuclei": {"available": true},
      // ... more tools
    },
    "testDomain": "example.com",
    "subdomainTest": {
      "subfinder": ["subdomain1.example.com"],
      "assetfinder": ["subdomain2.example.com"],
      "combined": ["subdomain1.example.com", "subdomain2.example.com"]
    }
  }
}
```

## 📊 **Expected Results**

After applying these fixes:

- ✅ All OSINT tools should be available
- ✅ `discoverSubdomains()` method should work
- ✅ Tool status should show availability correctly
- ✅ Rate limiting should prevent abuse
- ✅ Service test should pass completely

## 🔒 **Security Considerations**

1. **Ethical Usage**: All tools configured for ethical reconnaissance only
2. **Rate Limiting**: Prevents abuse and respects target resources
3. **Timeout Controls**: Prevents hanging operations
4. **Isolated Container**: Tools run in containerized environment
5. **Logging**: All operations logged for audit trails

## 🛠️ **Troubleshooting**

### If Build Fails:
- Ensure Docker has enough memory (4GB+ recommended)
- Check internet connection for tool downloads
- Verify Go installation in container

### If Tools Still Missing:
- Check container logs: `docker logs reconftw_container_name`
- Verify tool paths in container: `docker exec -it container_name ls /opt/reconftw`
- Test individual tools: `docker exec -it container_name subfinder --version`

### Performance Issues:
- Adjust timeouts in service configuration
- Modify rate limits based on your needs
- Consider running tools in parallel vs sequential

## 📝 **Next Steps**

1. **Monitor Performance**: Track tool execution times and success rates
2. **Add More Tools**: Consider adding amass, shodan-cli, etc.
3. **Enhance Output Parsing**: Improve result formatting and analysis
4. **Add Caching**: Cache results to reduce redundant scans
5. **Implement Webhooks**: Real-time notifications for findings
