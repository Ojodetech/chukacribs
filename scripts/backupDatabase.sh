#!/bin/bash

# ChukaCribs Database Backup Script
# Backs up MongoDB Atlas database to local directory
# Usage: ./scripts/backupDatabase.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
MAX_BACKUPS=7  # Keep last 7 backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.archive"

echo -e "${GREEN}🔄 ChukaCribs Database Backup Script${NC}"
echo "======================================"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Check if MongoDB URI is set
if [ -z "$MONGODB_URI" ]; then
    echo -e "${RED}❌ MONGODB_URI not set in .env${NC}"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Starting backup...${NC}"
echo "Backup file: $BACKUP_FILE"

# Extract database name from URI
DB_NAME=$(echo "$MONGODB_URI" | sed 's/.*\///')

# Run mongodump with connection string
if mongodump --uri="$MONGODB_URI" --archive="$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup completed successfully${NC}"
    echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
    
    # List all backups
    echo -e "\n${YELLOW}📋 Backup history:${NC}"
    ls -lh "$BACKUP_DIR"/backup_*.archive 2>/dev/null | tail -5 || echo "No previous backups"
    
    # Clean up old backups (keep only last 7)
    echo -e "\n${YELLOW}🧹 Cleaning up old backups (keeping last $MAX_BACKUPS)...${NC}"
    backup_count=$(ls -1 "$BACKUP_DIR"/backup_*.archive 2>/dev/null | wc -l)
    
    if [ $backup_count -gt $MAX_BACKUPS ]; then
        files_to_remove=$((backup_count - MAX_BACKUPS))
        echo "Removing $files_to_remove old backup(s)..."
        ls -1 "$BACKUP_DIR"/backup_*.archive | head -n $files_to_remove | xargs rm -f
        echo -e "${GREEN}✅ Cleanup completed${NC}"
    fi
else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Backup process finished${NC}"
