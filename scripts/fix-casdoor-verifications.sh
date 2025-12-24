#!/bin/bash

# Fix Casdoor Verifications Table Script
# This script creates the missing 'verifications' table for Casdoor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Casdoor Verifications Table Fix Script${NC}"
echo "=================================================="

# Default values
POSTGRES_PASSWORD="uWNZugjBqixf8dxC"
POSTGRES_USER="postgres"
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
CASDOOR_DB="casdoor"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --password)
      POSTGRES_PASSWORD="$2"
      shift 2
      ;;
    --user)
      POSTGRES_USER="$2"
      shift 2
      ;;
    --host)
      POSTGRES_HOST="$2"
      shift 2
      ;;
    --port)
      POSTGRES_PORT="$2"
      shift 2
      ;;
    --database)
      CASDOOR_DB="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --password PASSWORD    PostgreSQL password (default: uWNZugjBqixf8dxC)"
      echo "  --user USER           PostgreSQL user (default: postgres)"
      echo "  --host HOST           PostgreSQL host (default: localhost)"
      echo "  --port PORT           PostgreSQL port (default: 5432)"
      echo "  --database DATABASE   Casdoor database name (default: casdoor)"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                    # Use default settings"
      echo "  $0 --password mypass --host db-server # Use custom settings"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Check if PostgreSQL is accessible
echo -e "${YELLOW}📡 Checking PostgreSQL connection...${NC}"
if command -v docker >/dev/null 2>&1; then
    # Try to connect via Docker (for development setup)
    POSTGRES_CONTAINER=$(docker ps -q --filter "name=postgres" --filter "name=lobe-postgres" | head -1)

    if [ -n "$POSTGRES_CONTAINER" ]; then
        echo -e "${GREEN}✅ Found PostgreSQL container: $POSTGRES_CONTAINER${NC}"

        # Check if casdoor database exists
        echo -e "${YELLOW}🔍 Checking casdoor database...${NC}"
        DB_EXISTS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -c "\l" | grep -c "$CASDOOR_DB" || true)

        if [ "$DB_EXISTS" -eq 0 ]; then
            echo -e "${RED}❌ Database '$CASDOOR_DB' does not exist${NC}"
            exit 1
        fi

        # Check if verifications table exists
        echo -e "${YELLOW}🔍 Checking verifications table...${NC}"
        TABLE_EXISTS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$CASDOOR_DB" -c "\dt" | grep -c "verifications" || true)

        if [ "$TABLE_EXISTS" -gt 0 ]; then
            echo -e "${GREEN}✅ verifications table already exists${NC}"
            exit 0
        fi

        # Create the verifications table
        echo -e "${YELLOW}🔨 Creating verifications table...${NC}"
        docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$CASDOOR_DB" <<EOF
CREATE TABLE IF NOT EXISTS verifications (
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    id text PRIMARY KEY,
    identifier text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    value text NOT NULL
);
EOF

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ verifications table created successfully!${NC}"

            # Verify the table was created
            TABLE_COUNT=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$CASDOOR_DB" -c "\dt" | grep -c "verifications" || true)
            if [ "$TABLE_COUNT" -gt 0 ]; then
                echo -e "${GREEN}✅ Verification successful: verifications table exists${NC}"

                # Show table structure
                echo -e "${YELLOW}📋 Table structure:${NC}"
                docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$CASDOOR_DB" -c "\d verifications"
            else
                echo -e "${RED}❌ Verification failed: table was not created${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ Failed to create verifications table${NC}"
            exit 1
        fi

    else
        echo -e "${RED}❌ PostgreSQL container not found. Trying direct connection...${NC}"

        # Fallback to direct psql connection
        if command -v psql >/dev/null 2>&1; then
            PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$CASDOOR_DB" <<EOF
CREATE TABLE IF NOT EXISTS verifications (
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    id text PRIMARY KEY,
    identifier text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    value text NOT NULL
);
EOF
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ verifications table created successfully!${NC}"
            else
                echo -e "${RED}❌ Failed to create verifications table${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ Neither Docker container nor psql command found${NC}"
            echo "Please ensure PostgreSQL is running and accessible"
            exit 1
        fi
    fi
else
    echo -e "${RED}❌ Docker not found. Please install Docker or use psql directly${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Casdoor verifications table setup completed!${NC}"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "1. Restart your LobeChat application"
echo "2. Try logging in with Casdoor"
echo "3. The verification code functionality should now work properly"
echo ""
echo -e "${YELLOW}📝 Note: Add this script to your deployment process to automatically fix this issue in future deployments.${NC}"