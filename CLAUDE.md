# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LobeChat is an open-source, modern-design AI Agent Workspace (previously LobeChat) that supports speech synthesis, multimodal, and extensible Function Call plugin systems. It's a Next.js 16 application with React 19, built as a monorepo with TypeScript.

**Supported platforms:**
- Web desktop/mobile
- Desktop (Electron)
- Mobile app (React Native) - coming soon

**Logo emoji:** 🤯

## Technology Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **SPA Implementation:** `react-router-dom` inside Next.js
- **UI Framework:** `@lobehub/ui`, Ant Design
- **Styling:** antd-style (CSS-in-JS), lucide-react, `@ant-design/icons`
- **Layout:** react-layout-kit
- **State Management:** Zustand, nuqs (search params), SWR (data fetch), aHooks
- **Utilities:** dayjs (time), es-toolkit, lodash-es
- **Backend:** tRPC (type-safe), PGLite (client DB), Neon PostgreSQL (server DB), Drizzle ORM
- **Testing:** Vitest
- **Package Manager:** pnpm (monorepo), bun (script execution), bunx (executables)

## Git Workflow

- Current release branch: `next` (not `main`) until v2.0.0 is officially released
- Use rebase for git pull: `git pull --rebase`
- Commit messages must prefix with gitmoji
- Branch name format: `tj/feat/feature-name`
- PR titles starting with `✨ feat/` or `🐛 fix` will trigger the release workflow upon merge. Only use these prefixes for significant user-facing feature changes or bug fixes

## Package Management

```bash
# Install dependencies
pnpm install

# Run scripts (use bun)
bun run <script-name>

# Run executable packages
bunx <package-name>
```

## Development

```bash
# Start development server (web)
bun run dev              # Port 3010

# Start development server (desktop)
bun run dev:desktop      # Port 3015

# Start development server (mobile)
bun run dev:mobile       # Port 3018
```

## Building

```bash
# Build for production
bun run build

# Build with bundle analysis
bun run build:analyze

# Build desktop app
bun run desktop:build

# Build for Docker
bun run build:docker
```

## Linting & Type Checking

```bash
# Linting (includes type checking)
bun run lint

# Individual linting commands
bun run lint:ts          # TypeScript linting
bun run lint:style       # Style linting
bun run lint:circular    # Circular dependency check

# Type check only
bun run type-check
```

## Database

```bash
# Generate migrations and client
bun run db:generate

# Run database migrations
bun run db:migrate

# Open database studio
bun run db:studio
```

## Testing (CRITICAL)

**⚠️ IMPORTANT:** This project has 3000+ tests that take ~10 minutes to run. Always use file filtering.

```bash
# ❌ NEVER run these - will run all tests and take 10+ minutes
bun run test
bunx vitest run

# ✅ CORRECT - Run specific tests with file filtering
bunx vitest run --silent='passed-only' 'user.test.ts'
bunx vitest run --silent='passed-only' 'src/components/**/*.test.tsx'

# Run tests with coverage
bunx vitest run --silent='passed-only' --coverage 'filename.test.ts'
```

### Testing Best Practices

- **Prefer `vi.spyOn` over `vi.mock`**: Use `vi.spyOn` to mock specific functions rather than `vi.mock` to mock entire modules
- **Tests must pass type check**: After writing or modifying tests, run `bun run type-check`
- **Stop after 1-2 failed attempts**: If trying to fix the same test twice but still failed, stop and ask for help
- **Never manually wrap file paths in quotes** when using vitest commands - the tool handles this automatically

## Internationalization (i18n)

**Framework:** react-i18next with Next.js app router
**Source language:** Chinese (zh-CN)
**Supported languages:** 18 languages including English, Japanese, Korean, Arabic

### Workflow

1. **Adding new keys:** Add to `src/locales/default/[namespace].ts` files
2. **Export new namespaces:** Update `src/locales/default/index.ts`
3. **Development preview:** Translate `locales/zh-CN/namespace.json` and `locales/en-US/namespace.json` only
4. **DO NOT** run `pnpm i18n` manually - let CI handle automatic translation

### Usage in Components

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('common'); // namespace
return <div>{t('key.with.nested.structure')}</div>;
```

## Code Style Guidelines

### TypeScript

- Prefer `interface` over `type` for object shapes
- Use `@ts-expect-error` over `@ts-ignore` over `as any`
- Avoid explicit type annotations when TypeScript can infer
- Prefer `async`/`await` over promise chains
- Use the most accurate types possible (e.g., `Record<PropertyKey, unknown>` over `object`)

### UI/UX

- Use components from `@lobehub/ui` or Ant Design instead of raw HTML
- Design for dark mode and mobile responsiveness
- Use antd-style token system instead of hard-coded colors
- Select appropriate component variants

### Performance

- Prefer `for…of` loops over index-based `for` loops
- Query only required database columns
- Convert sequential async flows to concurrent with `Promise.all` where safe
- Reuse existing utils from `packages/utils`

### Imports

- When importing directory modules, prefer explicit index paths (`@/db/index` over `@/db`)

### Security

- Never log user private information (API keys, tokens, etc.)
- Don't use `import { log } from 'debug'` - it logs directly to console
- Validate inputs at system boundaries (user input, external APIs)
- Avoid meaningless null/undefined parameters in function contracts

## Project Architecture

### Monorepo Structure

This project uses a monorepo structure with workspace packages under `@lobechat/` namespace.

### Directory Structure

```
lobe-chat/
├── apps/
│   └── desktop/          # Electron desktop app
├── packages/
│   ├── agent-runtime/
│   ├── database/
│   │   ├── schemas/      # Drizzle ORM schemas
│   │   ├── models/       # Database models (CRUD)
│   │   └── repositories/ # BFF queries
│   ├── model-runtime/
│   ├── utils/
│   ├── types/
│   └── ...               # Other workspace packages
├── src/
│   ├── app/
│   │   ├── (backend)/    # Backend routes
│   │   │   ├── api/      # REST API routes
│   │   │   ├── trpc/     # tRPC routes
│   │   │   └── webapi/   # Web API routes
│   │   └── [variants]/   # Frontend routes
│   ├── components/       # Shared UI components
│   ├── features/         # Feature-specific components
│   ├── store/            # Zustand stores
│   │   ├── agent/
│   │   ├── chat/
│   │   └── user/
│   ├── services/         # Client services
│   ├── server/
│   │   ├── routers/      # tRPC routers (async/lambda/mobile/tools)
│   │   ├── services/     # Server services (can access DB)
│   │   └── modules/      # Server modules (no DB access)
│   ├── libs/             # Third-party integrations
│   └── locales/
│       └── default/      # i18n source files
└── locales/              # i18n translation files
```

### Data Flow Architecture

```
React UI → Store Actions → Client Service → TRPC Lambda → Server Services → DB Model → PostgreSQL
```

### Testing Environments

1. **Client Database (DOM Environment):** Happy DOM + PGLite (browser WASM)
2. **Server Database (Node Environment):** Node.js + PostgreSQL (use `TEST_SERVER_DB=1`)

### Test Organization

- Test files co-located with source files (`Component.test.tsx`)
- Test fixtures in `fixtures/` folders
- Some packages use `__tests__/` directories

### Mock Strategy

- Mock I/O operations (file system, network) but use realistic data formats
- Prefer `vi.stubGlobal()` and `vi.spyOn()` over direct global manipulation
- Use `@vitest-environment happy-dom` for browser API testing

## Common Gotchas

### Module Pollution

If tests behave differently when run together vs. individually:
- Suspect module pollution
- Use `vi.resetModules()` in `beforeEach()` to clear module cache

### Circular Dependencies

- Check with `bun run lint:circular`
- Pay attention to import cycles between services and stores

### Performance

- Full test suite takes ~10 minutes - always filter tests
- Use `--silent='passed-only'` to reduce noise
- Database migrations can be slow - use `TEST_SERVER_DB=1` sparingly

## Important Files

### Configuration

- `package.json` - Scripts and dependencies
- `next.config.ts` - Next.js configuration
- `vitest.config.mts` - Test configuration
- `drizzle.config.ts` - Database configuration

### Cursor Rules Reference

The `.cursor/rules/` directory contains detailed guides for specific topics:

- `project-introduce.mdc` - Tech stack overview
- `project-structure.mdc` - Detailed architecture
- `typescript.mdc` - TypeScript style guide
- `testing-guide/testing-guide.mdc` - **MUST READ** before testing
- `i18n.mdc` - Internationalization guide
- `react.mdc` - React component guidelines
- `zustand-action-patterns.mdc` - Zustand patterns
- `drizzle-schema-style-guide.mdc` - Database schema guide
- `rules-index.mdc` - Index of all rules

## Linear Issue Management

When working on Linear issues (if Linear MCP is installed):

1. **Before starting:** Get issue details using `mcp__linear-server__get_issue`
2. **Check sub-issues:** List all sub-issues with `mcp__linear-server__list_issues` using `parentId` filter
3. **Per-issue completion:** Update status and add comment for EACH issue immediately after completion
4. **Required comment:** Add completion summary using `mcp__linear-server__create_comment`

**Workflow for each issue:**
1. Complete implementation
2. Run `bun run type-check`
3. Run related tests if applicable
4. Create PR if needed
5. **IMMEDIATELY** update status to "In Review" (not "Done")
6. **IMMEDIATELY** add completion comment
7. Then move to next issue

**When creating issues:** MUST add the `claude code` label to indicate the issue was created by Claude Code.
