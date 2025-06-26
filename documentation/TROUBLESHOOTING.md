# eCFR Navigator Troubleshooting Guide

## Build Issues

### npm install errors
If you encounter npm install errors during build:

1. Clear Docker build cache:
```bash
docker-compose build --no-cache
```

2. Update base images:
```bash
docker-compose pull
```

### Missing dependencies
If build fails due to missing packages:

1. Check package.json files in each service directory
2. Ensure all required packages are listed
3. Rebuild the specific service:
```bash
docker-compose build [service-name]
```

## Access Issues

### Cannot access application
1. Ensure you're using the correct URL: http://localhost:8080
2. Check if Nginx is running:
```bash
docker-compose ps nginx
```
3. Verify port 8080 is not already in use:
```bash
lsof -i :8080  # On Linux/Mac
netstat -an | findstr :8080  # On Windows
```

## Runtime Issues

### MongoDB Connection Failed
```bash
# Check MongoDB status
docker-compose ps mongodb

# View MongoDB logs
docker-compose logs mongodb

# Test connection
docker-compose exec mongodb mongosh -u $MONGO_ROOT_USERNAME -p $MONGO_ROOT_PASSWORD
```

### Elasticsearch Not Responding
```bash
# Check Elasticsearch health
curl -X GET "localhost:9200/_cluster/health?pretty"

# View Elasticsearch logs
docker-compose logs elasticsearch

# Check if index exists
curl -X GET "localhost:9200/_cat/indices?v"
```

### Nginx Issues

#### Application not accessible on port 8080
```bash
# Check Nginx status
docker-compose ps nginx

# View Nginx logs
docker-compose logs nginx

# Test Nginx configuration
docker-compose exec nginx nginx -t
```

#### 502 Bad Gateway errors
This usually means the backend service is not responding:
```bash
# Check backend service
docker-compose ps backend
docker-compose logs backend

# Restart backend
docker-compose restart backend
```

#### 504 Gateway Timeout
If requests are timing out:
1. Check if backend is overwhelmed
2. Consider increasing Nginx timeout settings in nginx.conf
3. Check database connections

### Frontend Build Errors
Common issues and solutions:

1. **Missing types**: Install TypeScript types
```bash
cd services/frontend
npm install --save-dev @types/node
```

2. **Module not found**: Check imports and install missing packages

3. **Next.js errors**: Clear .next directory
```bash
cd services/frontend
rm -rf .next
npm run build
```

### Data Not Appearing

1. Check data-refresh service:
```bash
docker-compose logs data-refresh | tail -50
```

2. Verify MongoDB has data:
```bash
docker-compose exec mongodb mongosh -u $MONGO_ROOT_USERNAME -p $MONGO_ROOT_PASSWORD
use ecfr_db
db.titles.count()
```

3. Force data refresh:
```bash
docker-compose restart data-refresh
```

## Performance Issues

### High Memory Usage
1. Limit MongoDB cache:
```yaml
# In docker-compose.yml
mongodb:
  command: mongod --wiredTigerCacheSizeGB 1
```

2. Reduce OpenSearch heap:
```yaml
opensearch:
  environment:
    - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
```

### Slow Search Performance
1. Check OpenSearch index health:
```bash
curl -X GET "localhost:9200/_cat/health?v"
```

2. Optimize index:
```bash
curl -X POST "localhost:9200/ecfr_documents/_forcemerge?max_num_segments=1"
```

## Docker Issues

### Containers Keep Restarting
```bash
# Check container logs
docker-compose logs [service-name] | tail -50

# Check resource usage
docker stats

# Increase Docker memory allocation in Docker Desktop settings
```

### Port Conflicts
If ports are already in use:

1. Change ports in .env file
2. Or stop conflicting services:
```bash
# Find process using port
sudo lsof -i :3000
# Kill process
sudo kill -9 [PID]
```

## Data Issues

### Incomplete Data Download
1. Check download progress:
```bash
docker-compose logs data-refresh | grep -i "download"
```

2. Check for errors:
```bash
docker-compose logs data-refresh | grep -i "error"
```

3. Manually trigger download:
```bash
docker-compose exec data-refresh node index.js
```

### Corrupted Data
1. Clear MongoDB data:
```bash
docker-compose down
docker volume rm ecfr-analyzer_mongo-data
docker-compose up -d
```

2. Wait for fresh download

## Network Issues

### API Connection Errors
1. Check service connectivity:
```bash
docker-compose exec frontend ping backend
```

2. Verify network:
```bash
docker network ls
docker network inspect ecfr-analyzer_ecfr-network
```

### External API Failures
If govinfo.gov or ecfr.gov APIs are down:

1. Check API status
2. Wait and retry later
3. Check logs for specific error messages

## Quick Fixes

### Complete Reset
```bash
#all in one command
docker-compose down backend && docker system prune -f && docker-compose build --no-cache backend

# Stop all services
docker-compose down -v

# Remove all data
docker volume prune

# Rebuild everything
docker-compose up -d --build
```

### Service-specific Reset
```bash
# Restart single service
docker-compose restart [service-name]

# Rebuild single service
docker-compose up -d --build [service-name]
```

### View Real-time Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f [service-name]

# Last 100 lines
docker-compose logs --tail=100 [service-name]
```

## Getting Help

If issues persist:

1. Check service logs for detailed error messages
2. Verify all environment variables in .env
3. Ensure Docker has sufficient resources allocated
4. Check network connectivity to external APIs