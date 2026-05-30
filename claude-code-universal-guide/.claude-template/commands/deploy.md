# Deploy Command

Deploy application to production environment.

## Usage

```
/deploy [environment]
```

**Arguments:**
- `environment` (optional): `staging` or `production` (default: production)

## What It Does

1. Verifies on correct branch (main for production)
2. Runs pre-deployment checks (tests, build)
3. Builds Docker image (if containerized)
4. Pushes to container registry
5. Updates deployment configuration
6. Deploys to target environment
7. Waits for deployment stability
8. Verifies health checks

## Prerequisites

- [ ] On correct branch (main for production)
- [ ] All tests passing
- [ ] Build succeeds
- [ ] No uncommitted changes
- [ ] Required permissions/credentials

## Pre-Deployment Checklist

```bash
# 1. Run tests
npm test

# 2. Build application
npm run build

# 3. Type check (if TypeScript)
npm run type-check

# 4. Check git status
git status
```

## Manual Deployment Commands

<!-- CUSTOMIZE: Add your deployment commands -->

### Docker Deployment
```bash
# Build for production
docker build -t myapp:latest -f Dockerfile .

# Tag for registry
docker tag myapp:latest registry.example.com/myapp:latest
docker tag myapp:latest registry.example.com/myapp:$(date +%Y%m%d-%H%M%S)

# Login to registry
docker login registry.example.com

# Push
docker push registry.example.com/myapp:latest
docker push registry.example.com/myapp:$(date +%Y%m%d-%H%M%S)
```

### Kubernetes Deployment
```bash
# Update deployment
kubectl set image deployment/myapp myapp=registry.example.com/myapp:latest

# Wait for rollout
kubectl rollout status deployment/myapp

# Verify
kubectl get pods -l app=myapp
```

### AWS ECS Deployment
```bash
# Update service
aws ecs update-service \
  --cluster myapp-cluster \
  --service myapp-service \
  --force-new-deployment

# Wait for stability
aws ecs wait services-stable \
  --cluster myapp-cluster \
  --services myapp-service
```

### Serverless Deployment
```bash
# Deploy all functions
serverless deploy --stage production

# Deploy single function
serverless deploy function -f functionName
```

## Post-Deployment Verification

```bash
# Health check
curl -sf https://app.example.com/health

# Smoke test
npm run test:smoke -- --env=production

# Check logs
# AWS CloudWatch
aws logs tail /aws/ecs/myapp --since 5m --follow

# Kubernetes
kubectl logs -l app=myapp --tail=100 -f
```

## Rollback Procedure

```bash
# Kubernetes
kubectl rollout undo deployment/myapp

# ECS - deploy previous task definition
aws ecs update-service \
  --cluster myapp-cluster \
  --service myapp-service \
  --task-definition myapp:PREVIOUS_VERSION

# Docker Compose
docker-compose pull
docker-compose up -d --force-recreate
```

## Automated Deployment (GitHub Actions)

Deployments can be automated via GitHub Actions:
- **Trigger**: Push to `main` branch
- **Workflow**: `.github/workflows/deploy.yml`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEPLOY_ENV` | Target environment |
| `REGISTRY_URL` | Container registry URL |
| `CLUSTER_NAME` | Kubernetes/ECS cluster |

## Troubleshooting

### Deployment Stuck
- Check container logs
- Verify health check endpoint responds
- Check resource limits (CPU/memory)

### Health Check Failing
- Verify application started correctly
- Check database connectivity
- Review application logs

### Rollback Failed
- Check if previous version is available
- Verify registry has old images
- Manual intervention may be required

## Notes

- Browser cache: Users may need hard refresh (Cmd+Shift+R) after deploy
- Typical deployment time: ~5-10 minutes
- Always monitor for 15 minutes post-deployment
