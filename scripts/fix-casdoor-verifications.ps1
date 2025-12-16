# Fix Casdoor Verifications Table Script (PowerShell)
# This script creates the missing 'verifications' table for Casdoor

param(
    [string]$Password = "uWNZugjBqixf8dxC",
    [string]$User = "postgres",
    [string]$Host = "localhost",
    [int]$Port = 5432,
    [string]$Database = "casdoor",
    [switch]$Help
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$White = "White"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = $White
    )
    Write-Host $Message -ForegroundColor $Color
}

if ($Help) {
    Write-Host "Usage: .\fix-casdoor-verifications.ps1 [OPTIONS]" -ForegroundColor $Green
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Password PASSWORD    PostgreSQL password (default: uWNZugjBqixf8dxC)"
    Write-Host "  -User USER           PostgreSQL user (default: postgres)"
    Write-Host "  -Host HOST           PostgreSQL host (default: localhost)"
    Write-Host "  -Port PORT           PostgreSQL port (default: 5432)"
    Write-Host "  -Database DATABASE   Casdoor database name (default: casdoor)"
    Write-Host "  -Help                Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\fix-casdoor-verifications.ps1                                    # Use default settings"
    Write-Host "  .\fix-casdoor-verifications.ps1 -Password mypass -Host db-server   # Use custom settings"
    exit 0
}

Write-ColorOutput "🔧 Casdoor Verifications Table Fix Script" $Green
Write-Host "=================================================="

# Check if Docker is available
Write-ColorOutput "📡 Checking Docker..." $Yellow
$DockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($DockerAvailable) {
    # Try to find PostgreSQL container
    $PostgresContainer = docker ps -q --filter "name=postgres" --filter "name=lobe-postgres" | Select-Object -First 1

    if ($PostgresContainer) {
        Write-ColorOutput "✅ Found PostgreSQL container: $PostgresContainer" $Green

        # Check if casdoor database exists
        Write-ColorOutput "🔍 Checking casdoor database..." $Yellow
        $DBCheck = docker exec $PostgresContainer psql -U $User -c "\l" 2>$null
        $DBExists = $DBCheck -match $Database

        if (-not $DBExists) {
            Write-ColorOutput "❌ Database '$Database' does not exist" $Red
            exit 1
        }

        # Check if verifications table exists
        Write-ColorOutput "🔍 Checking verifications table..." $Yellow
        $TableCheck = docker exec $PostgresContainer psql -U $User -d $Database -c "\dt" 2>$null
        $TableExists = $TableCheck -match "verifications"

        if ($TableExists) {
            Write-ColorOutput "✅ verifications table already exists" $Green
            exit 0
        }

        # Create the verifications table
        Write-ColorOutput "🔨 Creating verifications table..." $Yellow

        $CreateTableSQL = @"
CREATE TABLE IF NOT EXISTS verifications (
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    id text PRIMARY KEY,
    identifier text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    value text NOT NULL
);
"@

        $Result = docker exec $PostgresContainer psql -U $User -d $Database -c $CreateTableSQL

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ verifications table created successfully!" $Green

            # Verify the table was created
            $VerifyTable = docker exec $PostgresContainer psql -U $User -d $Database -c "\dt" 2>$null
            $TableCreated = $VerifyTable -match "verifications"

            if ($TableCreated) {
                Write-ColorOutput "✅ Verification successful: verifications table exists" $Green

                # Show table structure
                Write-ColorOutput "📋 Table structure:" $Yellow
                docker exec $PostgresContainer psql -U $User -d $Database -c "\d verifications"
            } else {
                Write-ColorOutput "❌ Verification failed: table was not created" $Red
                exit 1
            }
        } else {
            Write-ColorOutput "❌ Failed to create verifications table" $Red
            exit 1
        }
    } else {
        Write-ColorOutput "❌ PostgreSQL container not found. Trying direct connection..." $Red

        # Fallback to direct psql connection
        $PsqlAvailable = Get-Command psql -ErrorAction SilentlyContinue

        if ($PsqlAvailable) {
            $env:PGPASSWORD = $Password

            $CreateTableSQL = @"
CREATE TABLE IF NOT EXISTS verifications (
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    id text PRIMARY KEY,
    identifier text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    value text NOT NULL
);
"@

            $Result = psql -h $Host -p $Port -U $User -d $Database -c $CreateTableSQL

            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ verifications table created successfully!" $Green
            } else {
                Write-ColorOutput "❌ Failed to create verifications table" $Red
                exit 1
            }

            # Clear the password from environment
            Remove-Item Env:PGPASSWORD
        } else {
            Write-ColorOutput "❌ Neither Docker container nor psql command found" $Red
            Write-Host "Please ensure PostgreSQL is running and accessible"
            exit 1
        }
    }
} else {
    Write-ColorOutput "❌ Docker not found. Please install Docker or use psql directly" $Red
    exit 1
}

Write-ColorOutput "🎉 Casdoor verifications table setup completed!" $Green
Write-Host ""
Write-ColorOutput "💡 Next steps:" $Yellow
Write-Host "1. Restart your LobeChat application"
Write-Host "2. Try logging in with Casdoor"
Write-Host "3. The verification code functionality should now work properly"
Write-Host ""
Write-ColorOutput "📝 Note: Add this script to your deployment process to automatically fix this issue in future deployments." $Yellow