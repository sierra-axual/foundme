const express = require('express');
const router = express.Router();

// Simple test route for OSINT
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'OSINT routes are working',
    timestamp: new Date().toISOString()
  });
});

// Simple tools status route
router.get('/tools/status', (req, res) => {
  res.json({
    success: true,
    data: {
      tools: {
        sherlock: { available: true, error: null },
        holehe: { available: true, error: null },
        h8mail: { available: true, error: null },
        maigret: { available: true, error: null },
        theharvester: { available: true, error: null }
      },
      total_available: 5,
      total_tools: 5
    }
  });
});

module.exports = router;
