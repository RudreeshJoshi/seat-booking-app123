// Socket.IO Client Utility for Real-time Seat Booking
import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    if (SocketManager.instance) {
      return SocketManager.instance;
    }

    this.socket = null;
    this.connected = false;
    this.currentShowId = null;
    this.currentUserId = null;
    this.eventListeners = new Map();

    SocketManager.instance = this;
  }

  // Connect to the Socket.IO server
  connect(serverUrl = null) {
    // Auto-detect server URL if not provided
    if (!serverUrl) {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      serverUrl = `${protocol}//${host}`;
    }
    if (this.socket && this.connected) {
      console.log('Socket already connected');
      return Promise.resolve(this.socket);
    }

    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        this.connected = true;
        resolve(this.socket);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO server:', reason);
        this.connected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.connected = false;
        reject(error);
      });

      // Set up event listeners
      this.setupEventListeners();
    });
  }

  // Disconnect from the server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentShowId = null;
      this.currentUserId = null;
    }
  }

  // Join a show room
  joinShow(showId, userId) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return false;
    }

    this.currentShowId = showId;
    this.currentUserId = userId;

    this.socket.emit('join-show', { showId, userId });
    console.log(`Joined show ${showId} as user ${userId}`);
    return true;
  }

  // Lock a seat
  lockSeat(seatId) {
    if (!this.socket || !this.connected || !this.currentShowId || !this.currentUserId) {
      console.error('Cannot lock seat: not connected or not in show');
      return false;
    }

    this.socket.emit('lock-seat', {
      showId: this.currentShowId,
      seatId,
      userId: this.currentUserId
    });
    return true;
  }

  // Unlock a seat
  unlockSeat(seatId) {
    if (!this.socket || !this.connected || !this.currentShowId || !this.currentUserId) {
      console.error('Cannot unlock seat: not connected or not in show');
      return false;
    }

    this.socket.emit('unlock-seat', {
      showId: this.currentShowId,
      seatId,
      userId: this.currentUserId
    });
    return true;
  }

  // Set up event listeners
  setupEventListeners() {
    if (!this.socket) return;

    // Listen for initial locked seats
    this.socket.on('locked-seat-initial', (lockedSeats) => {
      console.log('Received initial locked seats:', lockedSeats);
      this.emit('locked-seat-initial', lockedSeats);
    });

    // Listen for seat locked events
    this.socket.on('seat-locked', (data) => {
      console.log('Seat locked:', data);
      this.emit('seat-locked', data);
    });

    // Listen for seat unlocked events
    this.socket.on('seat-unlocked', (data) => {
      console.log('Seat unlocked:', data);
      this.emit('seat-unlocked', data);
    });

    // Listen for seat lock failures
    this.socket.on('seat-locked-failed', (data) => {
      console.log('Seat lock failed:', data);
      this.emit('seat-locked-failed', data);
    });

    // Start polling for updates (fallback for unreliable WebSockets)
    this.startPolling();
  }

  // Polling mechanism for reliable updates
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll every 3 seconds for seat status updates
    this.pollingInterval = setInterval(() => {
      if (this.currentShowId) {
        this.pollForUpdates();
      }
    }, 3000);

    console.log('Started polling for seat updates');
  }

  pollForUpdates() {
    // Emit a request to get current seat status
    if (this.socket && this.connected) {
      this.socket.emit('request-seat-status', { showId: this.currentShowId });
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Custom event emitter for local listeners
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  // Emit custom events to local listeners
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Remove event listener
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Get connection status
  isConnected() {
    return this.connected && this.socket;
  }

  // Get current show and user info
  getCurrentInfo() {
    return {
      showId: this.currentShowId,
      userId: this.currentUserId,
      connected: this.connected
    };
  }
}

// Create and export singleton instance
const socketManager = new SocketManager();
export default socketManager;
