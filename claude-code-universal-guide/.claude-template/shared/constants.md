# Shared Constants and Paths

## Project Paths

<!-- CUSTOMIZE: Update these paths for your project -->

### Main Project
- **Base**: `/path/to/your/project/`
- **Source**: `/path/to/your/project/src/`
- **Tests**: `/path/to/your/project/tests/`
- **Config**: `/path/to/your/project/config/`
- **Scripts**: `/path/to/your/project/scripts/`

### Documentation
- **AI Docs**: `/path/to/your/project/ai_docs/`
- **Schema**: `/path/to/your/project/ai_docs/schema/`
- **Architecture**: `/path/to/your/project/ai_docs/architecture/`
- **ADRs**: `/path/to/your/project/ai_docs/adr/`

## Credentials Location

<!-- CUSTOMIZE: Document where credentials are stored -->

- **Environment Variables**: `.env` file (gitignored)
- **Secrets Manager**: AWS Secrets Manager / HashiCorp Vault
- **API Keys**: Environment variables prefixed with `API_KEY_*`

## Infrastructure

<!-- CUSTOMIZE: Add your infrastructure details -->

### Database
- **Type**: PostgreSQL 15
- **Host**: `localhost` (dev) / `db.example.com` (prod)
- **Port**: `5432`
- **Database**: `myapp`
- **User**: `app_user`

### Cache
- **Type**: Redis 7
- **Host**: `localhost` (dev) / `cache.example.com` (prod)
- **Port**: `6379`

### Storage
- **Type**: S3 / MinIO
- **Bucket**: `myapp-storage`
- **Region**: `us-east-1`

## Cloud Resources

<!-- CUSTOMIZE: Add your cloud resource details -->

### AWS (Example)
- **Account**: `123456789012`
- **Profile**: `myapp-dev`
- **Region**: `us-east-1`

### Compute
- **ECS Cluster**: `myapp-cluster`
- **ECS Service**: `myapp-service`
- **Lambda Functions**: `myapp-*`

### Networking
- **VPC**: `vpc-12345678`
- **Subnets**: `subnet-abc123`, `subnet-def456`

## External Services

<!-- CUSTOMIZE: Add external service details -->

### Authentication
- **Provider**: Auth0 / Cognito / Custom
- **Domain**: `auth.example.com`

### Monitoring
- **APM**: Datadog / New Relic
- **Logs**: CloudWatch / ELK

### CI/CD
- **Platform**: GitHub Actions
- **Registry**: ECR / Docker Hub

## Common CLI Commands

### Development
```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Database
```bash
# Connect to local database
psql -h localhost -U app_user -d myapp

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### Deployment
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

### Git
```bash
# Create feature branch
git checkout -b feature/my-feature

# Create PR
gh pr create --title "feat: description" --body "..."

# Merge PR
gh pr merge <number> --squash
```

## Environment Variables

<!-- CUSTOMIZE: List required environment variables -->

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `API_KEY` | External API key | `sk-...` |

### Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity | `info` |
| `PORT` | Application port | `3000` |

## Naming Conventions

### Branches
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

### Commits
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Format: `type(scope): description`

### Files
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Constants: `SCREAMING_SNAKE_CASE`
- Config: `kebab-case.config.ts`
