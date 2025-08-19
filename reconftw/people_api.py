# FoundMe People OSINT API
# Specialized for people tracking and digital footprint mapping

from flask import Flask, jsonify, request
import subprocess
import json
import os
import time
import re
from datetime import datetime

app = Flask(__name__)

TOOLS_DIR = "/opt/people-osint"

# Map tool names to their wrapper scripts
PEOPLE_TOOLS = {
    "sherlock": f"{TOOLS_DIR}/sherlock_wrapper.sh",
    "theharvester": f"{TOOLS_DIR}/theharvester_wrapper.sh", 
    "holehe": f"{TOOLS_DIR}/holehe_wrapper.sh",
    "h8mail": f"{TOOLS_DIR}/h8mail_wrapper.sh",
    "maigret": f"{TOOLS_DIR}/maigret_wrapper.sh"
}

# Rate limiting for ethical usage
RATE_LIMITS = {
    "sherlock": {"calls": 0, "maxCalls": 50, "resetTime": time.time() + 3600},
    "theharvester": {"calls": 0, "maxCalls": 30, "resetTime": time.time() + 3600},
    "holehe": {"calls": 0, "maxCalls": 100, "resetTime": time.time() + 3600},
    "h8mail": {"calls": 0, "maxCalls": 20, "resetTime": time.time() + 3600},
    "maigret": {"calls": 0, "maxCalls": 60, "resetTime": time.time() + 3600}
}

def check_tool_availability(tool_name, tool_path):
    """Check if a people OSINT tool is available"""
    try:
        if os.path.exists(tool_path):
            return True, None
        return False, f"Tool not found: {tool_path}"
    except Exception as e:
        return False, str(e)

def check_rate_limit(tool_name):
    """Check and update rate limiting"""
    limit = RATE_LIMITS.get(tool_name)
    if limit:
        if time.time() > limit["resetTime"]:
            limit["calls"] = 0
            limit["resetTime"] = time.time() + 3600
        if limit["calls"] >= limit["maxCalls"]:
            return False
        limit["calls"] += 1
    return True

@app.route('/')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "service": "FoundMe People OSINT API", 
        "status": "OK", 
        "tools_available": len(PEOPLE_TOOLS),
        "purpose": "People tracking and digital footprint mapping"
    })

@app.route('/tools/status')
def tools_status():
    """Check availability of all people OSINT tools"""
    status = {}
    for tool_name, tool_path in PEOPLE_TOOLS.items():
        available, error = check_tool_availability(tool_name, tool_path)
        status[tool_name] = {"available": available, "error": error}
    return jsonify(status)

@app.route('/person/username-search', methods=['POST'])
def username_search():
    """Search for a username across social networks"""
    data = request.get_json()
    username = data.get('username')
    
    if not username:
        return jsonify({"success": False, "error": "Username is required"}), 400
    
    if not check_rate_limit("sherlock"):
        return jsonify({"success": False, "error": "Rate limit exceeded for username search"}), 429
    
    try:
        # Use Sherlock for comprehensive username search
        result = subprocess.run(
            [f"{TOOLS_DIR}/sherlock_wrapper.sh", username],
            capture_output=True, text=True, timeout=300
        )
        
        if result.returncode == 0:
            # Parse Sherlock JSON output
            try:
                with open('/tmp/sherlock_output.json', 'r') as f:
                    sherlock_data = json.load(f)
                
                # Extract found accounts
                found_accounts = []
                for account in sherlock_data:
                    if account.get('exists'):
                        found_accounts.append({
                            "platform": account.get('name', 'Unknown'),
                            "url": account.get('url', ''),
                            "username": account.get('username', username),
                            "status": "Found"
                        })
                
                return jsonify({
                    "success": True,
                    "username": username,
                    "total_found": len(found_accounts),
                    "accounts": found_accounts,
                    "tool": "sherlock"
                })
            except:
                # Fallback to text parsing
                return jsonify({
                    "success": True,
                    "username": username,
                    "output": result.stdout,
                    "tool": "sherlock"
                })
        else:
            return jsonify({
                "success": False,
                "error": result.stderr,
                "tool": "sherlock"
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Username search timed out"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/person/email-search', methods=['POST'])
def email_search():
    """Investigate an email address for breaches and accounts"""
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({"success": False, "error": "Email is required"}), 400
    
    results = {
        "email": email,
        "breaches": [],
        "accounts": [],
        "metadata": {}
    }
    
    # Check for breaches using H8mail
    if check_rate_limit("h8mail"):
        try:
            result = subprocess.run(
                [f"{TOOLS_DIR}/h8mail_wrapper.sh", email],
                capture_output=True, text=True, timeout=180
            )
            if result.returncode == 0:
                results["breaches"] = parse_h8mail_output(result.stdout)
        except:
            pass
    
    # Check for accounts using Holehe
    if check_rate_limit("holehe"):
        try:
            result = subprocess.run(
                [f"{TOOLS_DIR}/holehe_wrapper.sh", email],
                capture_output=True, text=True, timeout=180
            )
            if result.returncode == 0:
                results["accounts"] = parse_holehe_output(result.stdout)
        except:
            pass
    
    return jsonify({
        "success": True,
        "results": results
    })

@app.route('/person/phone-search', methods=['POST'])
def phone_search():
    """Investigate a phone number"""
    data = request.get_json()
    phone = data.get('phone')
    
    if not phone:
        return jsonify({"success": False, "error": "Phone number is required"}), 400
    
    if not check_rate_limit("phoneinfoga"):
        return jsonify({"success": False, "error": "Rate limit exceeded for phone search"}), 429
    
    try:
        result = subprocess.run(
            [f"{TOOLS_DIR}/phoneinfoga_wrapper.sh", phone],
            capture_output=True, text=True, timeout=120
        )
        
        if result.returncode == 0:
            return jsonify({
                "success": True,
                "phone": phone,
                "output": result.stdout,
                "tool": "phoneinfoga"
            })
        else:
            return jsonify({
                "success": False,
                "error": result.stderr,
                "tool": "phoneinfoga"
            }), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/person/full-profile', methods=['POST'])
def full_profile_search():
    """Comprehensive person investigation"""
    data = request.get_json()
    identifiers = data.get('identifiers', {})
    
    if not identifiers:
        return jsonify({"success": False, "error": "At least one identifier required"}), 400
    
    results = {
        "search_time": datetime.now().isoformat(),
        "identifiers": identifiers,
        "social_accounts": [],
        "emails": [],
        "phones": [],
        "breaches": [],
        "summary": {}
    }
    
    # Username search if provided
    if identifiers.get('username'):
        try:
            username_response = username_search()
            if hasattr(username_response, 'get_json'):
                username_data = username_response.get_json()
                if username_data and username_data.get('success'):
                    results["social_accounts"] = username_data.get('accounts', [])
        except:
            pass
    
    # Email search if provided
    if identifiers.get('email'):
        try:
            email_response = email_search()
            if hasattr(email_response, 'get_json'):
                email_data = email_response.get_json()
                if email_data and email_data.get('success'):
                    results["emails"] = email_data.get('results', {})
        except:
            pass
    
    # Phone search if provided
    if identifiers.get('phone'):
        try:
            phone_response = phone_search()
            if hasattr(phone_response, 'get_json'):
                phone_data = phone_response.get_json()
                if phone_data and phone_data.get('success'):
                    results["phones"] = phone_data.get('output', '')
        except:
            pass
    
    # Generate summary
    results["summary"] = {
        "total_social_accounts": len(results["social_accounts"]),
        "total_breaches": len(results.get("emails", {}).get("breaches", [])),
        "risk_score": calculate_risk_score(results)
    }
    
    return jsonify({
        "success": True,
        "results": results
    })

def parse_h8mail_output(output):
    """Parse H8mail breach output"""
    breaches = []
    # Simple parsing - can be enhanced
    for line in output.split('\n'):
        if 'breach' in line.lower() or 'leak' in line.lower():
            breaches.append(line.strip())
    return breaches

def parse_holehe_output(output):
    """Parse Holehe account output"""
    accounts = []
    # Simple parsing - can be enhanced
    for line in output.split('\n'):
        if 'found' in line.lower() or 'exists' in line.lower():
            accounts.append(line.strip())
    return accounts

def calculate_risk_score(results):
    """Calculate digital footprint risk score"""
    score = 0
    
    # Social accounts (higher = more exposed)
    score += len(results.get("social_accounts", [])) * 5
    
    # Breaches (critical risk)
    score += len(results.get("emails", {}).get("breaches", [])) * 20
    
    # Normalize to 0-100 scale
    return min(score, 100)

@app.route('/tools/<tool_name>/execute', methods=['POST'])
def execute_tool(tool_name):
    """Execute a specific people OSINT tool"""
    if tool_name not in PEOPLE_TOOLS:
        return jsonify({"success": False, "error": "Tool not found"}), 404
    
    if not check_rate_limit(tool_name):
        return jsonify({"success": False, "error": f"Rate limit exceeded for {tool_name}"}), 429
    
    data = request.get_json()
    args = data.get('args', '')
    timeout = data.get('timeout', 300)
    
    tool_path = PEOPLE_TOOLS[tool_name]
    
    try:
        command_parts = [tool_path]
        if args:
            command_parts.extend(args.split())
        
        result = subprocess.run(
            command_parts, 
            capture_output=True, 
            text=True, 
            timeout=timeout
        )
        
        if result.returncode == 0:
            return jsonify({
                "success": True,
                "output": result.stdout,
                "tool": tool_name
            })
        else:
            return jsonify({
                "success": False,
                "error": result.stderr,
                "tool": tool_name
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": f"Tool execution timed out"}), 408
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
