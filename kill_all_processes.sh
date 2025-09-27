#!/bin/bash

# Script to kill all processes started during the Tiny Legends development session
# This includes Next.js, Uvicorn, concurrently, npm, uv, and node processes

echo "🔄 Killing all development processes..."

# Kill processes by name patterns
echo "📱 Killing Next.js processes..."
pkill -f "next dev" 2>/dev/null || echo "  No Next.js processes found"

echo "🐍 Killing Uvicorn processes..."
pkill -f "uvicorn" 2>/dev/null || echo "  No Uvicorn processes found"

echo "⚡ Killing concurrently processes..."
pkill -f "concurrently" 2>/dev/null || echo "  No concurrently processes found"

echo "📦 Killing npm processes..."
pkill -f "npm run dev" 2>/dev/null || echo "  No npm dev processes found"

echo "🐍 Killing uv run dev processes..."
pkill -f "uv run dev" 2>/dev/null || echo "  No uv run dev processes found"

echo "🟢 Killing node processes (development only)..."
# Only kill node processes that are likely development servers
pkill -f "node.*next" 2>/dev/null || echo "  No Next.js node processes found"
pkill -f "node.*turbopack" 2>/dev/null || echo "  No Turbopack node processes found"

# Kill processes by port (more aggressive approach)
echo "🔌 Killing processes on development ports..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "  No processes on port 3000"
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "  No processes on port 3001"
lsof -ti:9000 | xargs kill -9 2>/dev/null || echo "  No processes on port 9000"

# Kill any remaining development-related processes
echo "🧹 Cleaning up any remaining development processes..."
pkill -f "dev:ui" 2>/dev/null || echo "  No dev:ui processes found"
pkill -f "dev:agent" 2>/dev/null || echo "  No dev:agent processes found"

echo "✅ All development processes have been terminated!"
echo ""
echo "📊 Checking for any remaining processes on development ports:"
echo "Port 3000: $(lsof -ti:3000 2>/dev/null | wc -l) processes"
echo "Port 3001: $(lsof -ti:3001 2>/dev/null | wc -l) processes" 
echo "Port 9000: $(lsof -ti:9000 2>/dev/null | wc -l) processes"
echo ""
echo "🎉 Cleanup complete! You can now restart the services fresh."
