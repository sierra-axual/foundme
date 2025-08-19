# FoundMe Simplified Development Environment
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://foundme_user:dev_password_secure_123@localhost:7942/foundme_dev
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=dev_jwt_secret_key_678_secure_development_only
BCRYPT_ROUNDS=12

# External APIs
HIBP_API_KEY=your_haveibeenpwned_api_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key_here

# Email/SMS
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
