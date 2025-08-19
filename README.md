# FoundMe Platform - Development Environment

A comprehensive OSINT (Open Source Intelligence) and digital footprint mapping platform with risk assessment capabilities.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose
- PowerShell (Windows) or Bash (Linux/Mac)

### Setup
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd foundme
   ```

2. **Run the automated setup script**
   ```powershell
   # Windows PowerShell
   .\scripts\dev-setup.ps1
   ```
   
   ```bash
   # Linux/Mac
   chmod +x scripts/dev-setup.sh
   ./scripts/dev-setup.sh
   ```

3. **Access your development environment**
   - Frontend: http://localhost:8472
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

## 🏗️ Architecture Overview

### Simplified Monolithic Design
The development environment uses a simplified architecture with all backend functionality consolidated into a single service:

- **Frontend**: React + TypeScript + Vite (Port 8472)
- **Backend**: Node.js + Express.js (Port 3001)
- **Database**: PostgreSQL (Port 7942)
- **Cache**: Redis (Port 6379)

### Key Features
- **OSINT Discovery**: Social media mapping, dark web monitoring, metadata extraction
- **Risk Assessment**: AI-powered risk scoring and analysis
- **Subscription Management**: Tiered plans with flexible billing
- **Real-time Notifications**: Email, SMS, and webhook support
- **Comprehensive Reporting**: PDF/HTML exports with customizable templates

## 📁 Project Structure

```
foundme/
├── frontend/                 # React frontend application
├── backend/                  # Monolithic backend API
│   ├── src/
│   │   ├── routes/          # API route definitions
│   │   ├── controllers/     # Business logic controllers
│   │   ├── models/          # Data models
│   │   ├── middleware/      # Custom middleware
│   │   ├── services/        # Business services
│   │   └── utils/           # Utility functions
│   ├── Dockerfile.dev       # Development Dockerfile
│   └── package.json         # Backend dependencies
├── database/                 # Database initialization scripts
│   └── init/                # SQL schema files
├── cache/                    # Redis data persistence
├── monitoring/               # Prometheus & Grafana configs
├── nginx/                    # Reverse proxy configuration
├── scripts/                  # Setup and utility scripts
├── docker-compose.simple.yml # Development environment
└── env.simple               # Environment variables template
```

## 🛠️ Development Commands

### Docker Operations
```bash
# Start all services
docker-compose -f docker-compose.simple.yml up -d

# View service logs
docker-compose -f docker-compose.simple.yml logs -f [service-name]

# Stop all services
docker-compose -f docker-compose.simple.yml down

# Restart a specific service
docker-compose -f docker-compose.simple.yml restart [service-name]

# View service status
docker-compose -f docker-compose.simple.yml ps

# Rebuild and start services
docker-compose -f docker-compose.simple.yml up -d --build
```

### Backend Development
```bash
# Install dependencies
cd backend
npm install

# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Frontend Development
```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Access Points

| Service | URL | Port | Description |
|---------|-----|-------|-------------|
| Frontend | http://localhost:8472 | 8472 | React application |
| Backend API | http://localhost:3001 | 3001 | REST API endpoints |
| PostgreSQL | localhost:7942 | 7942 | Main database |
| Redis | localhost:6379 | 6379 | Cache and sessions |
| Health Check | http://localhost:3001/health | 3001 | API health status |

## 🔐 Default Credentials

### Database
- **Database**: `foundme_dev`
- **Username**: `foundme_user`
- **Password**: `dev_password_secure_123`

### Environment Variables
Copy `env.simple` to `.env` and update with your actual API keys:
```bash
# External APIs
HIBP_API_KEY=your_haveibeenpwned_api_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key_here

# Email/SMS
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
```

## 📊 Monitoring & Observability

### Health Checks
- **Backend Health**: `GET /health`
- **Database Connectivity**: Built into health endpoint
- **Service Status**: Docker Compose status command

### Logs
```bash
# View all service logs
docker-compose -f docker-compose.simple.yml logs -f

# View specific service logs
docker-compose -f docker-compose.simple.yml logs -f backend
docker-compose -f docker-compose.simple.yml logs -f frontend
docker-compose -f docker-compose.simple.yml logs -f postgres
```

## 🚨 Troubleshooting

### Common Issues

#### Port Conflicts
If you encounter port conflicts, update the ports in `docker-compose.simple.yml`:
```yaml
ports:
  - "8473:3000"  # Change 8472 to another port
```

#### Database Connection Issues
1. Ensure PostgreSQL container is running: `docker-compose ps`
2. Check database logs: `docker-compose logs postgres`
3. Verify environment variables in `.env` file

#### Frontend Not Loading
1. Check if frontend container is running
2. Verify port 8472 is not blocked by firewall
3. Check browser console for errors

#### Backend API Errors
1. Verify backend container is running
2. Check backend logs: `docker-compose logs backend`
3. Test health endpoint: `curl http://localhost:3001/health`

### Reset Environment
```bash
# Stop and remove all containers
docker-compose -f docker-compose.simple.yml down -v

# Remove all images
docker-compose -f docker-compose.simple.yml down --rmi all

# Clean up volumes
docker volume prune

# Restart setup
.\scripts\dev-setup.ps1
```

## 🔧 Development Guidelines

### Code Quality
- Use ESLint for JavaScript/TypeScript linting
- Follow consistent naming conventions
- Write meaningful commit messages
- Test API endpoints before committing

### Security Best Practices
- Never commit API keys or secrets
- Use environment variables for configuration
- Validate all user inputs
- Implement proper authentication middleware
- Use HTTPS in production

### Performance Considerations
- Implement database connection pooling
- Use Redis for caching frequently accessed data
- Optimize database queries with proper indexing
- Implement rate limiting for API endpoints

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/auth/profile` - Get user profile

### Discovery Endpoints
- `POST /api/discovery/scan` - Start OSINT scan
- `GET /api/discovery/results/:scanId` - Get scan results
- `GET /api/discovery/status/:scanId` - Check scan status

### Risk Assessment Endpoints
- `POST /api/risk/calculate` - Calculate risk score
- `GET /api/risk/assessment/:riskId` - Get risk assessment
- `GET /api/risk/trends/:target` - Get risk trends

### Subscription Endpoints
- `GET /api/subscription/plans` - Get available plans
- `POST /api/subscription/create` - Create subscription
- `GET /api/subscription/current` - Get current subscription

### Notification Endpoints
- `POST /api/notification/send` - Send notification
- `GET /api/notification/history` - Get notification history
- `PUT /api/notification/preferences` - Update preferences

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

---

**Happy Coding! 🎉**
