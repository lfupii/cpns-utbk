#!/bin/bash

# Development Mode Start Script for macOS/Linux

echo "🚀 Starting Ujiin..."

# Check if terminals are available
command -v gnome-terminal &> /dev/null && TERMINAL="gnome-terminal"
command -v xterm &> /dev/null && TERMINAL="xterm"

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    TERMINAL="osascript"
fi

echo ""
echo "📋 Instructions:"
echo "1. Terminal 1: Backend (PHP Server)"
echo "2. Terminal 2: Frontend (React Dev Server)"
echo "3. Terminal 3: Database (MySQL)"
echo ""

# Backend
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell app "Terminal" to do script "cd '$PWD'/backend && php -S localhost:8000"'
else
    $TERMINAL -e "cd backend && php -S localhost:8000" &
fi

sleep 2

# Frontend
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell app "Terminal" to do script "cd '$PWD'/frontend && npm run dev"'
else
    $TERMINAL -e "cd frontend && npm run dev" &
fi

sleep 2

echo "✅ Servers starting..."
echo ""
echo "🌐 URLs:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   PhpMyAdmin: http://localhost/phpmyadmin"
echo ""
echo "📧 Test Account:"
echo "   Email: test@example.com"
echo "   Password: test1234"
echo ""
