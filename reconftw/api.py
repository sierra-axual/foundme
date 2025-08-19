#!/usr/bin/env python3
"""
ReconFTW HTTP API Server
Simple Flask API to execute OSINT tools via HTTP requests
"""

import os
import subprocess
import json
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Tool configurations
TOOLS = {
    'subfinder': {'cmd': 'subfinder', 'args_template': '-d {domain} -silent'},
    'assetfinder': {'cmd': 'assetfinder', 'args_template': '--subs-only {domain}'},
    'nmap': {'cmd': 'nmap', 'args_template': '-sS -sV -p {ports} {target}'},
    'nuclei': {'cmd': 'nuclei', 'args_template': '-u {url} -silent'},
    'dnsx': {'cmd': 'dnsx', 'args_template': '-d {domain} -silent'},
    'ffuf': {'cmd': 'ffuf', 'args_template': '-u {url} -w /usr/share/wordlists/common.txt'},
    'gobuster': {'cmd': 'gobuster', 'args_template': 'dir -u {url} -w /usr/share/wordlists/common.txt'},
    'wayback': {'cmd': 'waybackpy', 'args_template': '--url {url} --known_urls'},
    'whois': {'cmd': 'whois', 'args_template': '{domain}'},
    'dig': {'cmd': 'dig', 'args_template': '{domain} ANY'},
    'dirsearch': {'cmd': 'python3', 'args_template': '/opt/reconftw/dirsearch/dirsearch.py -u {url}'},
    'ctfr': {'cmd': 'python3', 'args_template': '/opt/reconftw/ctfr/ctfr.py -d {domain}'},
    'gitdorks': {'cmd': 'python3', 'args_template': '/opt/reconftw/GitDorker/GitDorker.py -tf {target}'},
    's3scanner': {'cmd': 's3scanner', 'args_template': '{target}'}
}

def execute_command(cmd, timeout=300):
    """Execute a command with timeout and return results"""
    try:
        logger.info(f"Executing: {cmd}")
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=timeout
        )
        
        return {
            'success': True,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': f'Command timed out after {timeout} seconds'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'ReconFTW API',
        'tools_available': len(TOOLS)
    })

@app.route('/tools/status', methods=['GET'])
def tool_status():
    """Check status of all tools"""
    status = {}
    
    for tool_name, tool_config in TOOLS.items():
        try:
            # Try to get version or help
            version_cmd = f"{tool_config['cmd']} --version 2>/dev/null || {tool_config['cmd']} --help 2>/dev/null | head -1"
            result = execute_command(version_cmd, timeout=10)
            
            status[tool_name] = {
                'available': result['success'] and result['returncode'] == 0,
                'error': None if result['success'] else result.get('error', 'Tool not found')
            }
        except Exception as e:
            status[tool_name] = {
                'available': False,
                'error': str(e)
            }
    
    return jsonify(status)

@app.route('/tools/<tool_name>/execute', methods=['POST'])
def execute_tool(tool_name):
    """Execute a specific tool with parameters"""
    if tool_name not in TOOLS:
        return jsonify({
            'success': False,
            'error': f'Tool {tool_name} not supported'
        }), 400
    
    try:
        data = request.get_json() or {}
        tool_config = TOOLS[tool_name]
        
        # Format the command with provided parameters
        args = tool_config['args_template'].format(**data)
        full_command = f"{tool_config['cmd']} {args}"
        
        # Execute the tool
        timeout = data.get('timeout', 300)  # 5 minutes default
        result = execute_command(full_command, timeout)
        
        # Parse output if it's a known format
        output = result.get('stdout', '')
        if tool_name in ['subfinder', 'assetfinder'] and output:
            # Parse subdomain results
            result['parsed_output'] = [
                line.strip() for line in output.split('\n') 
                if line.strip() and '.' in line
            ]
        
        return jsonify({
            'success': result['success'],
            'tool': tool_name,
            'command': full_command,
            'output': result.get('stdout', ''),
            'error': result.get('stderr', ''),
            'parsed_output': result.get('parsed_output'),
            'returncode': result.get('returncode')
        })
        
    except Exception as e:
        logger.error(f"Error executing {tool_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/discovery/subdomains', methods=['POST'])
def discover_subdomains():
    """High-level subdomain discovery using multiple tools"""
    try:
        data = request.get_json() or {}
        domain = data.get('domain')
        
        if not domain:
            return jsonify({
                'success': False,
                'error': 'Domain parameter is required'
            }), 400
        
        results = {
            'domain': domain,
            'subfinder': [],
            'assetfinder': [],
            'combined': []
        }
        
        # Run subfinder
        try:
            subfinder_cmd = f"subfinder -d {domain} -silent"
            subfinder_result = execute_command(subfinder_cmd, timeout=180)
            if subfinder_result['success']:
                results['subfinder'] = [
                    line.strip() for line in subfinder_result['stdout'].split('\n')
                    if line.strip() and '.' in line
                ]
        except Exception as e:
            logger.error(f"Subfinder error: {e}")
        
        # Run assetfinder
        try:
            assetfinder_cmd = f"assetfinder --subs-only {domain}"
            assetfinder_result = execute_command(assetfinder_cmd, timeout=180)
            if assetfinder_result['success']:
                results['assetfinder'] = [
                    line.strip() for line in assetfinder_result['stdout'].split('\n')
                    if line.strip() and '.' in line
                ]
        except Exception as e:
            logger.error(f"Assetfinder error: {e}")
        
        # Combine and deduplicate
        all_subdomains = results['subfinder'] + results['assetfinder']
        results['combined'] = sorted(list(set(all_subdomains)))
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Subdomain discovery error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Run the Flask server
    app.run(host='0.0.0.0', port=5000, debug=True)
