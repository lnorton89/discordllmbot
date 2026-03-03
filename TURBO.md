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

## Available Commands

```bash
# Run builds across all workspaces (with caching)
npm run build

# Run linting across all workspaces
npm run lint

# Run type checking across all workspaces
npm run type-check

# Run tests across all workspaces
npm run test

# Run docs generation
npm run docs:generate
```

## Task Pipeline

```
build
├── shared#build (first)
└── bot#build (depends on shared)
    └── dashboard#build (parallel)
    └── docs#build (parallel)

lint
└── depends on ^build (build dependencies first)

type-check
└── depends on ^build (build dependencies first)

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
npm run lint  # Sequential: bot && dashboard && shared
```

### After (Turbo)
```bash
npm run lint  # Parallel with caching
```

## Benefits

1. **Faster builds** - Parallel execution across workspaces
2. **Caching** - Skip tasks that haven't changed
3. **CI/CD optimization** - Remote caching shares cache across runs
4. **Smart rebuilds** - Only rebuild affected packages
5. **Consistent execution** - Defined task pipelines ensure correct order

## Troubleshooting

### View task graph
```bash
npx turbo run build --graph
```

### Dry run (see what would execute)
```bash
npx turbo run build --dry-run
```

### Force rebuild (ignore cache)
```bash
npx turbo run build --force
```

### View cache status
```bash
npx turbo prune
```

## Learn More

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Configuration Reference](https://turbo.build/repo/docs/reference/configuration)
- [CLI Reference](https://turbo.build/repo/docs/reference/command-line-reference)
