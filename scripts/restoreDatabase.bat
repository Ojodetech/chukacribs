@echo off
REM ChukaCribs Database Restore Script (Windows)
REM Restores MongoDB Atlas database from backup archive
REM Usage: restoreDatabase.bat backups\backup_YYYYMMDD_HHMMSS.archive

setlocal enabledelayedexpansion

echo.
echo =======================================
echo ChukaCribs Database Restore Script
echo =======================================
echo.

REM Check if backup file is provided
if "%~1"=="" (
    echo [ERROR] Usage: restoreDatabase.bat backups\backup_YYYYMMDD_HHMMSS.archive
    echo [ERROR] Example: restoreDatabase.bat backups\backup_20260123_143022.archive
    exit /b 1
)

REM Check if backup file exists
if not exist "%~1" (
    echo [ERROR] Backup file not found: %~1
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo [ERROR] .env file not found
    exit /b 1
)

REM Read MONGODB_URI from .env
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="MONGODB_URI" set MONGODB_URI=%%b
)

if "!MONGODB_URI!"=="" (
    echo [ERROR] MONGODB_URI not set in .env
    exit /b 1
)

echo.
echo [WARNING] You are about to RESTORE the database from: %~1
echo [WARNING] This will OVERWRITE existing data!
echo.
set /p confirm="Type 'yes' to confirm restore: "

if not "!confirm!"=="yes" (
    echo [INFO] Restore cancelled
    exit /b 0
)

echo.
echo [INFO] Starting restore...
echo [INFO] Backup file: %~1

REM Run mongorestore
mongorestore --uri="!MONGODB_URI!" --archive="%~1" --gzip --drop

if errorlevel 1 (
    echo.
    echo [ERROR] Restore failed
    exit /b 1
)

echo.
echo [SUCCESS] Restore completed successfully
echo [INFO] Database has been restored from backup
echo.
