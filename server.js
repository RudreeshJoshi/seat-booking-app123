const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Seat locking state management
const seatLocks = new Map(); // Map<showId, Map<seatId, {userId, lockTime, expiryTimer}>>
const userLocks = new Map(); // Map<userId, Set<seatId>>

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a show room
  socket.on('join-show', (data) => {
    const { showId, userId } = data;
    socket.join(`show-${showId}`);
    socket.userId = userId;
    socket.showId = showId;
    
    console.log(`User ${userId} joined show ${showId}`);
    
    // Send initial locked seats for this show
    const showLocks = seatLocks.get(showId);
    if (showLocks && showLocks.size > 0) {
      const lockedSeats = Array.from(showLocks.entries()).map(([seatId, lockInfo]) => ({
        seatId,
        userId: lockInfo.userId,
        lockTime: lockInfo.lockTime
      }));
      socket.emit('locked-seat-initial', lockedSeats);
    }
  });

  // Handle seat lock request
  socket.on('lock-seat', (data) => {
    const { showId, seatId, userId } = data;
    
    // Check if seat is already locked
    if (!seatLocks.has(showId)) {
      seatLocks.set(showId, new Map());
    }
    
    const showLocks = seatLocks.get(showId);
    
    if (showLocks.has(seatId)) {
      // Seat is already locked
      const existingLock = showLocks.get(seatId);
      socket.emit('seat-locked-failed', { 
        seatId, 
        message: 'Seat is already locked by another user',
        lockedBy: existingLock.userId
      });
      return;
    }

    // Lock the seat for 5 minutes (300000 ms)
    const lockInfo = {
      userId,
      lockTime: new Date().toISOString(),
      expiryTimer: setTimeout(() => {
        // Auto-unlock after 5 minutes
        unlockSeat(showId, seatId, userId, true);
      }, 300000) // 5 minutes
    };

    showLocks.set(seatId, lockInfo);
    
    // Track user locks
    if (!userLocks.has(userId)) {
      userLocks.set(userId, new Set());
    }
    userLocks.get(userId).add(seatId);

    console.log(`Seat ${seatId} locked for user ${userId} in show ${showId}`);
    
    // Notify all clients in the room (including sender for confirmation)
    io.to(`show-${showId}`).emit('seat-locked', {
      seatId,
      userId,
      lockTime: lockInfo.lockTime
    });
    
    // Also broadcast to all connected clients as backup
    socket.broadcast.emit('seat-locked', {
      seatId,
      userId,
      lockTime: lockInfo.lockTime,
      showId
    });
  });

  // Handle seat unlock request
  socket.on('unlock-seat', (data) => {
    const { showId, seatId, userId } = data;
    unlockSeat(showId, seatId, userId, false);
  });

  // Handle polling request for seat status
  socket.on('request-seat-status', (data) => {
    const { showId } = data;
    
    // Send current locked seats to requesting client
    const showLocks = seatLocks.get(showId);
    if (showLocks && showLocks.size > 0) {
      const lockedSeats = Array.from(showLocks.entries()).map(([seatId, lockInfo]) => ({
        seatId,
        userId: lockInfo.userId,
        lockTime: lockInfo.lockTime
      }));
      socket.emit('locked-seat-initial', lockedSeats);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Auto-unlock all seats held by this user
    const userId = socket.userId;
    const showId = socket.showId;
    
    if (userId && showId && userLocks.has(userId)) {
      const userSeats = userLocks.get(userId);
      userSeats.forEach(seatId => {
        unlockSeat(showId, seatId, userId, true);
      });
      userLocks.delete(userId);
    }
  });
});

// Helper function to unlock seats
function unlockSeat(showId, seatId, userId, isAuto) {
  if (!seatLocks.has(showId)) return;
  
  const showLocks = seatLocks.get(showId);
  const lockInfo = showLocks.get(seatId);
  
  if (lockInfo && lockInfo.userId === userId) {
    // Clear expiry timer
    if (lockInfo.expiryTimer) {
      clearTimeout(lockInfo.expiryTimer);
    }
    
    // Remove lock
    showLocks.delete(seatId);
    
    // Remove from user locks
    if (userLocks.has(userId)) {
      userLocks.get(userId).delete(seatId);
      if (userLocks.get(userId).size === 0) {
        userLocks.delete(userId);
      }
    }
    
    console.log(`Seat ${seatId} unlocked for user ${userId} in show ${showId} (${isAuto ? 'auto' : 'manual'})`);
    
    // Notify all clients in the room
    io.to(`show-${showId}`).emit('seat-unlocked', {
      seatId,
      userId,
      isAuto
    });
    
    // Also broadcast to all connected clients as backup
    io.emit('seat-unlocked', {
      seatId,
      userId,
      isAuto,
      showId
    });
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Seat Booking App running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`Socket.IO server ready for real-time seat booking`);
});
