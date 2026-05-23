#!/bin/bash

# ANSI Color Codes for beautiful logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}       ANTIGRAVITY AGENTIC STUDIO STARTUP          ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Ensure Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python3 is not installed or not in PATH.${NC}"
    exit 1
fi

# 1. Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}[1/4] Creating local Python virtual environment (.venv)...${NC}"
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error creating virtual environment.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Virtual environment created successfully.${NC}"
else
    echo -e "${GREEN}✓ Virtual environment (.venv) already exists.${NC}"
fi

# 2. Upgrade pip and install dependencies
echo -e "${YELLOW}[2/4] Upgrading pip & installing dependencies...${NC}"
.venv/bin/pip install --upgrade pip

# Install dependencies from requirements.txt
.venv/bin/pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to install Python dependencies from requirements.txt.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ All dependencies installed successfully.${NC}"

# 3. Handle Credentials Check
echo -e "${YELLOW}[3/4] Checking environment configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}! .env file not found. Creating a template...${NC}"
    echo "GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE" > .env
fi

# Check for placeholder key
if grep -q "YOUR_GEMINI_API_KEY_HERE" .env; then
    echo -e "${RED}! Action Needed: Replace 'YOUR_GEMINI_API_KEY_HERE' in your '.env' file with a valid Gemini API Key.${NC}"
    echo -e "  Get a free key from: https://aistudio.google.com/app/api-keys"
else
    echo -e "${GREEN}✓ GEMINI_API_KEY detected in .env.${NC}"
fi

# 4. Launch FastAPI Dev Server
echo -e "${YELLOW}[4/4] Launching backend dev server...${NC}"
echo -e "${GREEN}🚀 Antigravity Agentic Studio running at http://localhost:8000${NC}"
echo -e "${BLUE}Press Ctrl+C to stop the server.${NC}"
echo -e "${BLUE}----------------------------------------------------${NC}"

.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
