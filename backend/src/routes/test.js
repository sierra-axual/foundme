const express = require('express');
const router = express.Router();

// Simple test route
router.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Test OSINT route loading
router.get('/osint-test', (req, res) => {
  res.json({ 
    message: 'OSINT test route working',
    timestamp: new Date().toISOString(),
    routes: ['/ping', '/osint-test']
  });
});

module.exports = router;
