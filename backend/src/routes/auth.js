const express = require('express');
const { z } = require('zod');
const router = express.Router();

// Validation schemas
const registrationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  firstName: z.string().min(2).max(50).trim(),
  lastName: z.string().min(2).max(50).trim()
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1)
});

// User registration
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const validationResult = registrationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { email, password, firstName, lastName } = validationResult.data;

    // TODO: Implement actual user registration logic
    // - Check if user already exists
    // - Hash password
    // - Create user in database
    // - Generate JWT token

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: 'temp-user-id',
        email,
        firstName,
        lastName,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error during registration'
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors
      });
    }

    const { email, password } = validationResult.data;

    // TODO: Implement actual login logic
    // - Verify user exists
    // - Verify password hash
    // - Generate JWT token
    // - Update last login timestamp

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: 'temp-user-id',
        email,
        firstName: 'John',
        lastName: 'Doe'
      },
      token: 'temp-jwt-token'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error during login'
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    // TODO: Implement JWT verification middleware
    // TODO: Fetch user profile from database

    res.status(200).json({
      user: {
        id: 'temp-user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Internal server error fetching profile'
    });
  }
});

module.exports = router;
