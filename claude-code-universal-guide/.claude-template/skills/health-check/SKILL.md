---
name: health-check
description: System health diagnostics and status checks for infrastructure, services, and dependencies.
---

# Health Check Skill

## Overview

Run comprehensive health checks on system infrastructure, services, and dependencies to verify operational status.

## Quick Check Commands

### Application Health
```bash
# Check if application is running
curl -s http://localhost:3000/health | jq .

# Check API response time
time curl -s http://localhost:3000/api/status
```

### Database Health
```bash
# PostgreSQL
psql -h localhost -U user -d database -c "SELECT 1;"

# MySQL
mysql -h localhost -u user -p database -e "SELECT 1;"

# Redis
redis-cli ping
```

### Docker Services
```bash
# Check running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check container health
docker inspect --format='{{.State.Health.Status}}' container_name
```

### Node.js Dependencies
```bash
# Check for outdated packages
npm outdated

# Audit for vulnerabilities
npm audit
```

## Comprehensive Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "=== System Health Check ==="
echo "Time: $(date)"
echo ""

# 1. Application
echo "## Application"
if curl -sf http://localhost:3000/health > /dev/null; then
    echo "  [OK] Application is responding"
else
    echo "  [FAIL] Application is not responding"
fi

# 2. Database
echo "## Database"
if psql -h localhost -U user -d database -c "SELECT 1;" > /dev/null 2>&1; then
    echo "  [OK] Database is accessible"
else
    echo "  [FAIL] Database is not accessible"
fi

# 3. Redis
echo "## Redis"
if redis-cli ping > /dev/null 2>&1; then
    echo "  [OK] Redis is responding"
else
    echo "  [FAIL] Redis is not responding"
fi

# 4. Disk Space
echo "## Disk Space"
df -h / | tail -1 | awk '{
    if ($5+0 > 90) print "  [WARN] Disk usage: " $5;
    else print "  [OK] Disk usage: " $5
}'

# 5. Memory
echo "## Memory"
free -h | grep Mem | awk '{print "  [INFO] Memory: " $3 " / " $2}'

# 6. Docker (if applicable)
echo "## Docker Services"
if command -v docker &> /dev/null; then
    docker ps --format "  [INFO] {{.Names}}: {{.Status}}" 2>/dev/null || echo "  [WARN] Docker not running"
else
    echo "  [INFO] Docker not installed"
fi

echo ""
echo "=== Health Check Complete ==="
```

## Service-Specific Checks

### Web Server (Nginx)
```bash
# Check status
systemctl status nginx

# Test configuration
nginx -t

# Check error log
tail -20 /var/log/nginx/error.log
```

### Process Manager (PM2)
```bash
# Check all processes
pm2 list

# Check logs
pm2 logs --lines 50
```

### AWS Resources
```bash
# Check Lambda function
aws lambda get-function --function-name my-function --query 'Configuration.State'

# Check RDS status
aws rds describe-db-instances --db-instance-identifier my-db --query 'DBInstances[0].DBInstanceStatus'

# Check ECS service
aws ecs describe-services --cluster my-cluster --services my-service --query 'services[0].runningCount'
```

## Monitoring Endpoints

### Standard Health Endpoint Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.2.3",
  "checks": {
    "database": { "status": "healthy", "latency_ms": 5 },
    "redis": { "status": "healthy", "latency_ms": 1 },
    "external_api": { "status": "healthy", "latency_ms": 120 }
  }
}
```

### Implementing Health Endpoint (Node.js)
```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
  };

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    checks
  });
});
```

## Troubleshooting

### Application Not Responding
1. Check if process is running: `ps aux | grep node`
2. Check port is in use: `lsof -i :3000`
3. Check logs: `pm2 logs` or `docker logs container`

### Database Connection Failed
1. Check credentials in .env
2. Verify network connectivity: `nc -zv localhost 5432`
3. Check max connections: `SELECT count(*) FROM pg_stat_activity;`

### High Memory Usage
1. Identify process: `top -o %MEM`
2. Check for memory leaks in Node.js: Use `--inspect` flag
3. Consider restarting service

### Disk Space Low
1. Find large files: `du -sh /* | sort -rh | head -10`
2. Clean logs: `journalctl --vacuum-size=100M`
3. Remove unused Docker images: `docker system prune -a`

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU Usage | > 80% | > 95% |
| Memory Usage | > 80% | > 95% |
| Disk Usage | > 80% | > 90% |
| Response Time | > 500ms | > 2000ms |
| Error Rate | > 1% | > 5% |

## Automation

### Cron Job for Regular Checks
```bash
# Add to crontab: crontab -e
# Run every 5 minutes
*/5 * * * * /path/to/health-check.sh >> /var/log/health-check.log 2>&1
```

### GitHub Actions Health Check
```yaml
- name: Health Check
  run: |
    curl -sf ${{ env.APP_URL }}/health || exit 1
```
