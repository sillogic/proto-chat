# Scripts Directory

This directory contains various utility scripts for LobeChat development and deployment.

## Database Scripts

### Database Migration
- **Purpose**: Run database migrations for LobeChat schema
- **Command**: `npm run db:migrate`
- **Description**: Creates and updates LobeChat database tables using Drizzle migrations

### Fix Casdoor Verifications Table
- **Purpose**: Creates the missing `verifications` table for Casdoor authentication
- **Command**: `npm run db:fix-casdoor`
- **Scripts**:
  - `fix-casdoor-verifications.ps1` (Windows PowerShell)
  - `fix-casdoor-verifications.sh` (Linux/macOS Bash)

## Fix Casdoor Verifications Table

### Problem
Casdoor requires a `verifications` table for storing verification codes, but this table might be missing in some deployment scenarios, causing errors like:

```
error: relation "verifications" does not exist
```

### Solution
The fix script automatically creates the required table with the correct schema.

### Usage

#### Windows (PowerShell)
```bash
# Using npm script (recommended)
npm run db:fix-casdoor

# Or run directly
.\scripts\fix-casdoor-verifications.ps1

# With custom parameters
.\scripts\fix-casdoor-verifications.ps1 -Password "yourpassword" -Host "yourdbhost" -Database "casdoor"
```

#### Linux/macOS (Bash)
```bash
# Make script executable
chmod +x scripts/fix-casdoor-verifications.sh

# Run with default settings
./scripts/fix-casdoor-verifications.sh

# With custom parameters
./scripts/fix-casdoor-verifications.sh --password "yourpassword" --host "yourdbhost" --database "casdoor"
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `password` | `uWNZugjBqixf8dxC` | PostgreSQL password |
| `user` | `postgres` | PostgreSQL username |
| `host` | `localhost` | PostgreSQL host |
| `port` | `5432` | PostgreSQL port |
| `database` | `casdoor` | Casdoor database name |

### Table Schema
The script creates the following table structure:

```sql
CREATE TABLE verifications (
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    id text PRIMARY KEY,
    identifier text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    value text NOT NULL
);
```

## Deployment Integration

### Docker Deployment
Add this to your Docker Compose deployment process:

```yaml
# Add after PostgreSQL container starts
  casdoor-fix:
    image: postgres:latest
    depends_on:
      postgresql:
        condition: service_healthy
    command: >
      sh -c "
        until pg_isready -h postgresql -U postgres; do
          echo 'Waiting for PostgreSQL...'
          sleep 2
        done
        PGPASSWORD=$${POSTGRES_PASSWORD} psql -h postgresql -U postgres -d casdoor -c '
        CREATE TABLE IF NOT EXISTS verifications (
            created_at timestamp with time zone DEFAULT now(),
            expires_at timestamp with time zone,
            id text PRIMARY KEY,
            identifier text NOT NULL,
            updated_at timestamp with time zone DEFAULT now(),
            value text NOT NULL
        );'
      "
    env_file:
      - .env
```

### CI/CD Pipeline
Add this step to your deployment pipeline:

```yaml
- name: Fix Casdoor Database
  run: |
    npm run db:fix-casdoor
```

## Troubleshooting

### Common Issues

1. **Docker container not found**
   - Ensure PostgreSQL container is running
   - Check container name matches expected pattern (postgres/lobe-postgres)

2. **Permission denied**
   - Run script with appropriate privileges
   - Check PostgreSQL user permissions

3. **Database connection failed**
   - Verify database connection parameters
   - Check if PostgreSQL service is running

4. **Table already exists**
   - Script handles this gracefully and will not create duplicate tables

### Verification
After running the script, verify the table was created:

```sql
-- Connect to casdoor database
\c casdoor

-- List tables
\dt

-- Verify verifications table structure
\d verifications
```

## Additional Information

- The script is safe to run multiple times - it uses `CREATE TABLE IF NOT EXISTS`
- Both Docker and direct PostgreSQL connections are supported
- The script works with default development settings and can be customized for production environments
- Error handling includes proper exit codes for CI/CD integration