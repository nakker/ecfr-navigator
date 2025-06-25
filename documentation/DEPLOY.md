# eCFR Analyzer Deployment Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 10GB free disk space
- Stable internet connection

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   cd ecfr-analyzer
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env to set secure passwords
   ```

3. **Build and start all services:**
   ```bash
   ./quick-start.sh
   # Or use Docker Compose directly:
   # docker-compose up -d --build
   ```

4. **Monitor the initial data download:**
   ```bash
   docker-compose logs -f data-refresh
   ```
   Note: Initial download may take 30-60 minutes depending on your internet speed.

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Service Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   Backend API   │────▶│    MongoDB      │
│   (Next.js)     │     │   (Express)     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                         ▲
                                ▼                         │
                        ┌─────────────────┐              │
                        │  Elasticsearch  │              │
                        │                 │              │
                        └─────────────────┘              │
                                                         │
┌─────────────────┐                            ┌─────────────────┐
│  Data Refresh   │────────────────────────────│  Data Analysis  │
│    Service      │                            │    Service      │
└─────────────────┘                            └─────────────────┘
```

## Monitoring Services

Check service status:
```bash
docker-compose ps
```

View logs for specific service:
```bash
docker-compose logs -f [service-name]
# Examples:
docker-compose logs -f backend
docker-compose logs -f data-refresh
```

## Common Operations

### Restart a service:
```bash
docker-compose restart [service-name]
```

### Stop all services:
```bash
docker-compose down
```

### Stop and remove all data:
```bash
docker-compose down -v
```

### Update services:
```bash
docker-compose pull
docker-compose up -d --build
```

## Troubleshooting

### 1. MongoDB Connection Issues
```bash
# Check MongoDB is running
docker-compose exec mongodb mongosh -u $MONGO_ROOT_USERNAME -p

# View MongoDB logs
docker-compose logs mongodb
```

### 2. Elasticsearch Issues
```bash
# Check Elasticsearch health
curl -X GET "localhost:9200/_cluster/health?pretty"

# Check indices
curl -X GET "localhost:9200/_cat/indices?v"
```

### 3. Data not appearing
```bash
# Check data-refresh service
docker-compose logs data-refresh | grep -i error

# Force re-download
docker-compose restart data-refresh
```

### 4. Frontend build issues
```bash
# Rebuild frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Performance Tuning

### MongoDB
Edit docker-compose.yml to add:
```yaml
mongodb:
  command: mongod --wiredTigerCacheSizeGB 2
```

### Elasticsearch
Increase heap size in docker-compose.yml:
```yaml
elasticsearch:
  environment:
    - ES_JAVA_OPTS=-Xms1g -Xmx1g
```

## Backup and Restore

### Backup MongoDB:
```bash
docker-compose exec mongodb mongodump --uri="mongodb://root:password@localhost:27017" --out=/backup
docker cp ecfr-mongodb:/backup ./mongo-backup
```

### Restore MongoDB:
```bash
docker cp ./mongo-backup ecfr-mongodb:/backup
docker-compose exec mongodb mongorestore --uri="mongodb://root:password@localhost:27017" /backup
```

## Security Considerations

1. **Change default passwords** in `.env` before deployment
2. **Use HTTPS** in production (configure reverse proxy)
3. **Limit exposed ports** using firewall rules
4. **Regular updates** of Docker images
5. **Monitor logs** for suspicious activity

## Production Deployment

For production deployment:

1. Use Docker Swarm or Kubernetes
2. Set up proper SSL/TLS certificates
3. Configure external MongoDB and OpenSearch clusters
4. Set up monitoring (Prometheus, Grafana)
5. Configure log aggregation (ELK stack)
6. Set up automated backups