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
- **UI Framework:** `@lobehub/ui`, Ant Design
- **Styling:** antd-style (CSS-in-JS), lucide-react, `@ant-design/icons`
- **Layout:** react-layout-kit
- **State Management:** Zustand, nuqs (search params), SWR (data fetch), aHooks
- **Utilities:** dayjs (time), lodash-es
- **Backend:** tRPC (type-safe), PGLite (client DB), Neon PostgreSQL (server DB), Drizzle ORM
- **Testing:** Vitest
- **Package Manager:** pnpm (monorepo), bun (script execution), bunx (executables)

## Architecture

### High-Level Structure

This is a monorepo with workspace packages using `@lobechat/` namespace.

**Data Flow Architecture:**
- **Web with ClientDB:** React UI → Client Service → Direct Model Access → PGLite (Web WASM)
- **Web with ServerDB:** React UI → Client Service → tRPC Lambda → Server Services → PostgreSQL (Remote)
- **Desktop (Cloud sync disabled):** Electron UI → Client Service → tRPC Lambda → Local Server Services → PGLite (Node WASM)
- **Desktop (Cloud sync enabled):** Electron UI → Client Service → tRPC Lambda → Cloud Server Services → PostgreSQL (Remote)

### Key Directories

- `src/components`, `src/features` - UI Components
- `src/layout` - Global providers
- `src/store` - Zustand stores
- `src/services/` - Cross-platform services (clientDB: `client.ts`, serverDB: `server.ts`)
- `src/app/(backend)/webapi` - REST API routers
- `src/server/routers/{edge|lambda|async|desktop|tools}` - tRPC routers
- `src/server/services` - Server-only services (can access serverDB)
- `src/server/modules` - Server-only third-party modules (no DB access)
- `packages/database/src/schemas` - Drizzle schemas
- `packages/database/src/models` - CRUD models
- `packages/database/src/repositories` - BFF queries
- `src/libs` - Third-party integrations (analytics, oidc, etc.)

## Development Commands

### Package Management
```bash
# Install dependencies
pnpm install

# Run scripts (use bun)
bun run <script-name>

# Run executable packages
bunx <package-name>
```

### Development
```bash
# Start development server (web)
bun run dev              # Port 3010

# Start development server (desktop)
bun run dev:desktop      # Port 3015

# Start development server (mobile)
bun run dev:mobile       # Port 3018
```

### Building
```bash
# Build for production
bun run build

# Build with bundle analysis
bun run build:analyze

# Build for Docker
bun run build:docker

# Build desktop app
bun run desktop:build
```

### Type Checking and Linting
```bash
# Type checking
bun run typecheck

# Linting (includes type checking)
bun run lint

# Individual linting commands
bun run lint:ts          # TypeScript linting
bun run lint:style       # Style linting
bun run lint:circular    # Circular dependency check
```

### Database Operations
```bash
# Generate database schema and client
bun run db:generate

# Run database migrations
bun run db:migrate

# Open database studio
bun run db:studio

# Visualize database schema
bun run db:visualize
```

### Testing (CRITICAL: Read testing guide before running tests)

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

# Run tests for packages (e.g., database)
cd packages/database && bunx vitest run --silent='passed-only' '[file-pattern]'

# Run server database tests (requires TEST_SERVER_DB=1)
cd packages/database && TEST_SERVER_DB=1 bunx vitest run --silent='passed-only' '[file-pattern]'
```

**Testing Rules:**
- Always read `.cursor/rules/testing-guide/testing-guide.mdc` before writing tests
- If you fail to fix the same test twice, stop and ask for help
- Test files should be in the same directory as source files with `.test.ts` or `.test.tsx` suffix

## Git Workflow

- Current release branch: `next` (not `main`) until v2.0.0 release
- Use rebase for git pull (`git pull --rebase`)
- Commit messages must prefix with gitmoji
- Branch name format: `tj/feat/feature-name`
- Use `.github/PULL_REQUEST_TEMPLATE.md` for PR descriptions

## Internationalization (i18n)

**Framework:** react-i18next with Next.js app router
**Source language:** Chinese (zh-CN)
**Supported languages:** 18 languages including English, Japanese, Korean, Arabic

**Workflow:**
1. **Adding new keys:** Add to `src/locales/default/[namespace].ts` files
2. **Export new namespaces:** Update `src/locales/default/index.ts`
3. **Development preview:** Translate `locales/zh-CN/namespace.json` and `locales/en-US/namespace.json` only
4. **DO NOT** run `pnpm i18n` manually - let CI handle automatic translation

**Usage in components:**
```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('common'); // namespace
return <div>{t('key.with.nested.structure')}</div>;
```

## Code Style Guidelines

### TypeScript
- Prefer interface over type for object shapes
- Use `@ts-expect-error` over `@ts-ignore` over `as any`
- Avoid explicit type annotations when TypeScript can infer
- Prefer async/await over promise chains
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

## Linear Issue Management

When working on Linear issues:

1. **Before starting:** Get issue details using `mcp__linear-server__get_issue`
2. **Check sub-issues:** List all sub-issues with `mcp__linear-server__list_issues` using `parentId` filter
3. **Per-issue completion:** Update status and add comment for EACH issue immediately after completion
4. **Required comment:** Add completion summary using `mcp__linear-server__create_comment`

**Workflow for each issue:**
1. Complete implementation
2. Run `bun run typecheck`
3. Run related tests if applicable
4. Create PR if needed
5. **IMMEDIATELY** update status to "In Review" (not "Done")
6. **IMMEDIATELY** add completion comment
7. Then move to next issue

## Important Files and References

### Cursor Rules (Project Guidelines)
- `.cursor/rules/project-introduce.mdc` - Tech stack overview
- `.cursor/rules/project-structure.mdc` - Detailed architecture
- `.cursor/rules/typescript.mdc` - TypeScript style guide
- `.cursor/rules/testing-guide/testing-guide.mdc` - **MUST READ** before testing
- `.cursor/rules/i18n.mdc` - Internationalization guide
- `.cursor/rules/rules-index.mdc` - Index of all rules

### Configuration
- `package.json` - Scripts and dependencies
- `next.config.mjs` - Next.js configuration
- `vitest.config.ts` - Test configuration
- `drizzle.config.ts` - Database configuration

### Database
- `packages/database/src/schemas/` - Drizzle ORM schemas
- `packages/database/src/models/` - Database models
- `packages/database/src/repositories/` - Database query repositories

## Security Best Practices

- Never log user private information (API keys, tokens, etc.)
- Don't use `import { log } from 'debug'` - it logs directly to console
- Validate inputs at system boundaries (user input, external APIs)
- Avoid meaningless null/undefined parameters in function contracts

## Testing Strategy

### Two Testing Environments
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