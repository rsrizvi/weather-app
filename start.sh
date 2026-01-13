#!/bin/bash

echo "🌤️  Starting Weather App..."
echo ""

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Install backend dependencies and start server
echo "📦 Installing backend dependencies..."
cd backend
npm install

echo ""
echo "🚀 Starting backend server on http://localhost:5002..."
npm start &
BACKEND_PID=$!

cd ..

# Wait a moment for backend to initialize
sleep 2

# Install frontend dependencies and start server
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo ""
echo "🚀 Starting frontend on http://localhost:3000..."
npm start &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ Weather App is running!"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:5002"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait
