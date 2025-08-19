# 🐳 Development Environment Architecture Specification

## Overview
This document outlines the Docker-based development environment architecture for the FoundMe Data Discovery & Footprint Mapping platform. All ports have been randomized to avoid conflicts with existing projects.

## 🏗️ Architecture Components

### Frontend Application
- **Technology**: React + TypeScript + Vite
- **Port**: 8472 (randomized from default 3000)
- **Container**: `foundme-frontend-dev`
- **Volume Mounts**: 
  - `./frontend/src:/app/src`
  - `./frontend/public:/app/public`
  - `./frontend/package.json:/app/package.json`

### Backend API Gateway
- **Technology**: Node.js + Express
- **Port**: 5928 (randomized from default 3001)
- **Container**: `foundme-api-gateway-dev`
- **Volume Mounts**:
  - `./api-gateway/src:/app/src`
  - `./api-gateway/package.json:/app/package.json`

### Authentication Service
- **Technology**: Node.js + JWT + bcrypt
- **Port**: 7341 (randomized from default 3002)
- **Container**: `foundme-auth-service-dev`
- **Volume Mounts**:
  - `./services/auth/src:/app/src`
  - `./services/auth/package.json:/app/package.json`

### Discovery Service
- **Technology**: Node.js + Puppeteer + Cheerio
- **Port**: 9156 (randomized from default 3003)
- **Container**: `foundme-discovery-service-dev`
- **Volume Mounts**:
  - `./services/discovery/src:/app/src`
  - `./services/discovery/package.json:/app/package.json`

### Risk Assessment Service
- **Technology**: Node.js + ML libraries
- **Port**: 6483 (randomized from default 3004)
- **Container**: `foundme-risk-service-dev`
- **Volume Mounts**:
  - `./services/risk/src:/app/src`
  - `./services/risk/package.json:/app/package.json`

### Subscription Service
- **Technology**: Node.js + Stripe integration
- **Port**: 3729 (randomized from default 3005)
- **Container**: `foundme-subscription-service-dev`
- **Volume Mounts**:
  - `./services/subscription/src:/app/src`
  - `./services/subscription/package.json:/app/package.json`

### Notification Service
- **Technology**: Node.js + WebSocket + Email/SMS
- **Port**: 4857 (randomized from default 3006)
- **Container**: `foundme-notification-service-dev`
- **Volume Mounts**:
  - `./services/notification/src:/app/src`
  - `./services/notification/package.json:/app/package.json`

## 📋 Data Storage

### PostgreSQL Database
- **Port**: 7942 (randomized from default 5432)
- **Container**: `foundme-postgres-dev`
- **Environment Variables**:
  - `POSTGRES_DB=foundme_dev`
  - `POSTGRES_USER=foundme_user`
  - `POSTGRES_PASSWORD=dev_password_secure_123`
- **Volume Mounts**:
  - `./database/postgres_data:/var/lib/postgresql/data`
  - `./database/init:/docker-entrypoint-initdb.d`

### Redis Cache
- **Port**: 6379 (randomized from default 6379)
- **Container**: `foundme-redis-dev`
- **Volume Mounts**:
  - `./cache/redis_data:/data`

### MongoDB (for unstructured data)
- **Port**: 27017 (randomized from default 27017)
- **Container**: `foundme-mongodb-dev`
- **Environment Variables**:
  - `MONGO_INITDB_ROOT_USERNAME=foundme_admin`
  - `MONGO_INITDB_ROOT_PASSWORD=dev_mongo_secure_456`
- **Volume Mounts**:
  - `./database/mongo_data:/data/db`
  - `./database/mongo-init:/docker-entrypoint-initdb.d`

## 🔌 Message Queue & Event Bus

### RabbitMQ
- **Port**: 5672 (randomized from default 5672)
- **Management UI Port**: 15672 (randomized from default 15672)
- **Container**: `foundme-rabbitmq-dev`
- **Environment Variables**:
  - `RABBITMQ_DEFAULT_USER=foundme_user`
  - `RABBITMQ_DEFAULT_PASS=dev_rabbit_secure_789`
- **Volume Mounts**:
  - `./queue/rabbitmq_data:/var/lib/rabbitmq`
  - `./queue/definitions.json:/etc/rabbitmq/definitions.json`

## 📊 Monitoring & Observability

### Prometheus
- **Port**: 9090 (randomized from default 9090)
- **Container**: `foundme-prometheus-dev`
- **Volume Mounts**:
  - `./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml`
  - `./monitoring/prometheus_data:/prometheus`

### Grafana
- **Port**: 3000 (randomized from default 3000)
- **Container**: `foundme-grafana-dev`
- **Environment Variables**:
  - `GF_SECURITY_ADMIN_PASSWORD=dev_grafana_secure_012`
- **Volume Mounts**:
  - `./monitoring/grafana/provisioning:/etc/grafana/provisioning`
  - `./monitoring/grafana/dashboards:/var/lib/grafana/dashboards`

## 🌐 Reverse Proxy & Load Balancer

### Nginx
- **Port**: 80 (randomized from default 80)
- **Container**: `foundme-nginx-dev`
- **Volume Mounts**:
  - `./nginx/nginx.conf:/etc/nginx/nginx.conf`
  - `./nginx/conf.d:/etc/nginx/conf.d`

## 🔑 Security & Secrets

### Vault (Optional)
- **Port**: 8200 (randomized from default 8200)
- **Container**: `foundme-vault-dev`
- **Environment Variables**:
  - `VAULT_DEV_ROOT_TOKEN_ID=dev_vault_token_345`
- **Volume Mounts**:
  - `./secrets/vault_data:/vault/data`

## 📁 Project Structure
```
