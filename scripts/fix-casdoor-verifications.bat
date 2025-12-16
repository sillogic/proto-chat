@echo off
REM Fix Casdoor Verifications Table Script (Batch)
REM This script creates the missing 'verifications' table for Casdoor

echo 🔧 Casdoor Verifications Table Fix Script
echo ==================================================

set POSTGRES_PASSWORD=uWNZugjBqixf8dxC
set POSTGRES_USER=postgres
set POSTGRES_HOST=localhost
set POSTGRES_PORT=5432
set CASDOOR_DB=casdoor

if "%1"=="--help" goto :help
if "%1"=="-h" goto :help

:main
echo 📡 Checking Docker connection...
docker --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Docker not found. Please install Docker or use psql directly
    goto :eof
)

REM Find PostgreSQL container
for /f "tokens=*" %%i in ('docker ps -q --filter "name=postgres" --filter "name=lobe-postgres" 2^>nul') do set POSTGRES_CONTAINER=%%i

if defined POSTGRES_CONTAINER (
    echo ✅ Found PostgreSQL container: %POSTGRES_CONTAINER%

    echo 🔍 Checking casdoor database...
    docker exec %POSTGRES_CONTAINER% psql -U %POSTGRES_USER% -c "\l" | findstr /C:"%CASDOOR_DB%" >nul
    if %ERRORLEVEL% neq 0 (
        echo ❌ Database '%CASDOOR_DB%' does not exist
        goto :eof
    )

    echo 🔍 Checking verifications table...
    docker exec %POSTGRES_CONTAINER% psql -U %POSTGRES_USER% -d %CASDOOR_DB% -c "\dt" | findstr /C:"verifications" >nul
    if %ERRORLEVEL% equ 0 (
        echo ✅ verifications table already exists
        goto :eof
    )

    echo 🔨 Creating verifications table...
    docker exec %POSTGRES_CONTAINER% psql -U %POSTGRES_USER% -d %CASDOOR_DB% -c "CREATE TABLE IF NOT EXISTS verifications (created_at timestamp with time zone DEFAULT now(), expires_at timestamp with time zone, id text PRIMARY KEY, identifier text NOT NULL, updated_at timestamp with time zone DEFAULT now(), value text NOT NULL);"

    if %ERRORLEVEL% equ 0 (
        echo ✅ verifications table created successfully!

        REM Verify table was created
        docker exec %POSTGRES_CONTAINER% psql -U %POSTGRES_USER% -d %CASDOOR_DB% -c "\dt" | findstr /C:"verifications" >nul
        if %ERRORLEVEL% equ 0 (
            echo ✅ Verification successful: verifications table exists
            echo 📋 Table structure:
            docker exec %POSTGRES_CONTAINER% psql -U %POSTGRES_USER% -d %CASDOOR_DB% -c "\d verifications"
        ) else (
            echo ❌ Verification failed: table was not created
            goto :eof
        )
    ) else (
        echo ❌ Failed to create verifications table
        goto :eof
    )
) else (
    echo ❌ PostgreSQL container not found
    goto :eof
)

echo.
echo 🎉 Casdoor verifications table setup completed!
echo.
echo 💡 Next steps:
echo 1. Restart your LobeChat application
echo 2. Try logging in with Casdoor
echo 3. The verification code functionality should now work properly
echo.
goto :eof

:help
echo Usage: fix-casdoor-verifications.bat [OPTIONS]
echo.
echo This script creates the missing 'verifications' table for Casdoor.
echo It works with the default Docker Compose setup for LobeChat.
echo.
echo Examples:
echo   fix-casdoor-verifications.bat           # Use default settings
echo.
echo Note: This script uses the default development settings:
echo   - Database: casdoor
echo   - User: postgres
echo   - Container: postgres or lobe-postgres
echo.
goto :eof