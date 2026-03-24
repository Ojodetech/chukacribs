@echo off
REM ChukaCribs Database Backup Script (Windows)
REM Backs up MongoDB Atlas database to local directory
REM Usage: backupDatabase.bat

setlocal enabledelayedexpansion

REM Colors not available in batch, using text instead
echo.
echo =======================================
echo ChukaCribs Database Backup Script
echo =======================================
echo.

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

REM Create backup directory
if not exist "backups" mkdir backups

REM Generate timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set TIMESTAMP=!mydate!_!mytime!
set BACKUP_FILE=backups\backup_!TIMESTAMP!.archive

echo [INFO] Starting backup...
echo [INFO] Backup file: !BACKUP_FILE!
echo.

REM Run mongodump
mongodump --uri="!MONGODB_URI!" --archive="!BACKUP_FILE!" --gzip

if errorlevel 1 (
    echo [ERROR] Backup failed
    exit /b 1
)

echo.
echo [SUCCESS] Backup completed successfully
for %%F in ("!BACKUP_FILE!") do echo File size: %%~zF bytes
echo.

REM List recent backups
echo [INFO] Recent backups:
dir /o-d backups\backup_*.archive 2>nul | findstr /R "backup_.*archive"

echo.
echo [SUCCESS] Backup process finished
