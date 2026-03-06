# Turbo Setup

This monorepo now uses [Turborepo](https://turbo.build/) for optimized builds and task execution.

## What is Turbo?

Turborepo is a build system that optimizes monorepo workflows with:
- **Remote caching** - Share cache across machines and CI/CD
- **Parallel execution** - Run tasks in parallel across workspaces
- **Task pipelines** - Define task dependencies and execution order
- **Smart rebuilding** - Only rebuild what changed

## Configuration Files

### `turbo.json`
Main configuration file that defines:
- Global dependencies and environment variables
- Task pipelines with dependencies
- Cache settings and output directories
- Persistent tasks (like dev servers)

### `.turboignore`
Specifies files and directories to exclude from Turbo's cache consideration.

### `package.json`
Updated with:
- `packageManager` field (required by Turbo)
- Turbo scripts for `build`, `lint`, `type-check`, and `test`

### `docker-compose.yml`
Integrated with Turbo for containerized development:
- Turbo cache volume for persistent caching across container restarts
- Filtered task execution for each service
- Environment variables for Turbo telemetry

## Available Commands

### Local Development
```bash
# Run builds across all workspaces (with caching)
bun run build

# Run linting across all workspaces
bun run lint

# Run type checking across all workspaces
bun run type-check

# Run tests across all workspaces
bun run test

# Run docs generation
bun run docs:generate
```

### Docker Compose with Turbo
```bash
# Start all services with Turbo optimization
bun run dev

# Start all services (including docs)
bun run dev:all

# Rebuild and start
bun run dev:build

# View logs
bun run dev:logs

# Stop all services
bun run dev:down
```

### Turbo-Specific Commands
```bash
# View task dependency graph
bun run turbo:graph

# Prune cache
bun run turbo:prune

# Clean cache
bun run turbo:clean

# Build specific workspace
bun run build:bot
bun run build:dashboard
bun run build:shared
```

## Task Pipeline

```
build
├── shared#build (first)
└── bot#build (depends on shared)
    └── dashboard#build (parallel)
    └── docs#build (parallel)

lint
└── cache enabled (no dependencies)

type-check
└── cache enabled (no dependencies)

test
└── depends on build
```

## Cache Behavior

| Task | Cache | Outputs |
|------|-------|---------|
| `build` | ✅ | `dist/`, `build/`, `.vitepress/dist/` |
| `lint` | ✅ | - |
| `type-check` | ✅ | - |
| `test` | ❌ | - |
| `dev` | ❌ (persistent) | - |
| `dev:container` | ❌ (persistent) | - |

## Docker Compose Integration

### Turbo Cache Volume
The `turbo-cache` volume persists Turbo's cache across container restarts, enabling:
- Faster container rebuilds
- Shared cache between bot, dashboard, and docs services
- Efficient CI/CD pipeline execution

### Service Configuration
Each service in `docker-compose.yml` is configured with:
- Turbo cache volume mount: `turbo-cache:/usr/src/app/.turbo`
- Turbo configuration mount: `./turbo.json:/usr/src/app/turbo.json`
- Filtered task execution: `--filter=<workspace-name>`
- Telemetry disabled: `TURBO_TELEMETRY_DISABLED=1`

### Example Service (Bot)
```yaml
bot:
  build:
    context: .
    dockerfile: bot/Dockerfile.bot
  volumes:
    - ./bot:/usr/src/app/bot
    - ./turbo.json:/usr/src/app/turbo.json
    - turbo-cache:/usr/src/app/.turbo
  command: bunx turbo run dev:container --filter=discordllmbot
  environment:
    - TURBO_TELEMETRY_DISABLED=1
```

## Environment Variables

Turbo considers these environment variables for cache hashing:
- Discord: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`
- LLM: `GEMINI_API_KEY`, `OLLAMA_API_URL`, `QWEN_API_KEY`, `QWEN_OAUTH_CLIENT_ID`
- Database: `POSTGRES_*`, `DATABASE_URL`
- Ports: `API_PORT`, `DASHBOARD_PORT`, `DOCS_PORT`
- pgAdmin: `PGADMIN_DEFAULT_*`

## Workspaces

- `bot/` - Discord bot + Express API
- `dashboard/` - React + Vite dashboard
- `shared/` - Shared utilities
- `docs/` - VitePress documentation

## Migration Notes

### Before (npm workspaces)
```bash
bun run lint  # Sequential: bot && dashboard && shared
```

### After (Turbo)
```bash
bun run lint  # Parallel with caching
```

## Benefits

1. **Faster builds** - Parallel execution across workspaces
2. **Caching** - Skip tasks that haven't changed
3. **CI/CD optimization** - Remote caching shares cache across runs
4. **Smart rebuilds** - Only rebuild affected packages
5. **Consistent execution** - Defined task pipelines ensure correct order
6. **Docker integration** - Persistent cache volume for containerized development

## Troubleshooting

### View task graph
```bash
bun run turbo:graph
```

### Dry run (see what would execute)
```bash
bunx turbo run build --dry-run
```

### Force rebuild (ignore cache)
```bash
bunx turbo run build --force
```

### View cache status
```bash
bun run turbo:prune
```

### Clean cache (if experiencing issues)
```bash
bun run turbo:clean
```

### Rebuild all containers with fresh cache
```bash
bun run dev:build
```

## Learn More

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Configuration Reference](https://turbo.build/repo/docs/reference/configuration)
- [CLI Reference](https://turbo.build/repo/docs/reference/command-line-reference)
