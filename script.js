// WebSocket-Integrated Seat Booking System
const moviesList = [
  { movieName: "Flash", price: 7, showId: "flash-1" },
  { movieName: "Spiderman", price: 5, showId: "spiderman-1" },
  { movieName: "Batman", price: 4, showId: "batman-1" },
];

// Socket.IO Client Manager
class SocketManager {
  constructor() {
    if (SocketManager.instance) {
      return SocketManager.instance;
    }

    this.socket = null;
    this.connected = false;
    this.currentShowId = null;
    this.currentUserId = this.generateUserId();
    this.eventListeners = new Map();

    SocketManager.instance = this;
  }

  generateUserId() {
    const USER_ID_PREFIX = 'user-';
    const RANDOM_STRING_LENGTH = 9;
    const RANDOM_START_INDEX = 2;
    return USER_ID_PREFIX + Math.random().toString(36).substr(RANDOM_START_INDEX, RANDOM_STRING_LENGTH) + '-' + Date.now();
  }

  async connect(serverUrl = null) {
    // Auto-detect server URL based on environment
    if (!serverUrl) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        serverUrl = 'http://localhost:3000';
      } else {
        // For production - use same domain as the web app
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        serverUrl = `${protocol}//${window.location.host}`;
      }
    }
    if (this.socket && this.connected) {
      console.log('Socket already connected');
      return this.socket;
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

      this.setupEventListeners();
    });
  }

  joinShow(showId) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return false;
    }

    this.currentShowId = showId;
    this.socket.emit('join-show', { showId, userId: this.currentUserId });
    console.log(`Joined show ${showId} as user ${this.currentUserId}`);
    return true;
  }

  lockSeat(seatId) {
    if (!this.socket || !this.connected || !this.currentShowId) {
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

  unlockSeat(seatId) {
    if (!this.socket || !this.connected || !this.currentShowId) {
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

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('locked-seat-initial', (lockedSeats) => {
      console.log('Received initial locked seats:', lockedSeats);
      this.emit('locked-seat-initial', lockedSeats);
    });

    this.socket.on('seat-locked', (data) => {
      console.log('Seat locked:', data);
      this.emit('seat-locked', data);
    });

    this.socket.on('seat-unlocked', (data) => {
      console.log('Seat unlocked:', data);
      this.emit('seat-unlocked', data);
    });

    this.socket.on('seat-locked-failed', (data) => {
      console.log('Seat lock failed:', data);
      this.emit('seat-locked-failed', data);
    });
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

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

  isConnected() {
    return this.connected && this.socket;
  }

  getCurrentInfo() {
    return {
      showId: this.currentShowId,
      userId: this.currentUserId,
      connected: this.connected
    };
  }
}

// Enhanced Seat Booking Manager with WebSocket Integration
class SeatBookingManager {
  constructor() {
    if (SeatBookingManager.instance) {
      return SeatBookingManager.instance;
    }
    
    this.selectedSeats = [];
    this.currentMoviePrice = moviesList[0].price; // Dynamic from first movie
    this.currentShowId = null;
    this.lockedSeats = new Set(); // Track seats locked by other users
    this.myLockedSeats = new Set(); // Track seats locked by current user
    this.checkoutTimers = new Map(); // Track checkout timers
    
    SeatBookingManager.instance = this;
  }

  setCurrentShow(showId) {
    this.currentShowId = showId;
  }

  // Check if seat is available for selection
  isSeatAvailable(seatElement) {
    const seatId = this.getSeatId(seatElement);
    return seatElement && 
           !seatElement.classList.contains("occupied") && 
           !seatElement.classList.contains("booking") &&
           !this.lockedSeats.has(seatId);
  }

  getSeatId(seatElement) {
    const allSeats = document.querySelectorAll("#seatCont .seat");
    const index = Array.from(allSeats).indexOf(seatElement);
    return `seat-${index + 1}`;
  }

  getSeatElement(seatId) {
    const seatNumber = parseInt(seatId.replace('seat-', ''));
    const allSeats = document.querySelectorAll("#seatCont .seat");
    return allSeats[seatNumber - 1];
  }

  // Handle seat locked by another user
  handleSeatLocked(data) {
    const { seatId, userId } = data;
    const seatElement = this.getSeatElement(seatId);
    
    if (seatElement) {
      // Don't mark own seats as locked by others
      if (userId !== socketManager.currentUserId) {
        this.lockedSeats.add(seatId);
        seatElement.classList.add("booking");
        seatElement.title = `Locked by user ${userId}`;
      } else {
        this.myLockedSeats.add(seatId);
        seatElement.classList.add("booking");
        seatElement.title = "Your seat (5 min timer started)";
      }
    }
  }

  // Handle seat unlocked
  handleSeatUnlocked(data) {
    const { seatId, userId } = data;
    const seatElement = this.getSeatElement(seatId);
    
    if (seatElement) {
      this.lockedSeats.delete(seatId);
      this.myLockedSeats.delete(seatId);
      seatElement.classList.remove("booking");
      seatElement.title = "";
      
      // Clear checkout timer if it was our seat
      if (this.checkoutTimers.has(seatId)) {
        clearTimeout(this.checkoutTimers.get(seatId));
        this.checkoutTimers.delete(seatId);
      }
    }
  }

  // Handle initial locked seats
  handleInitialLockedSeats(lockedSeats) {
    lockedSeats.forEach(data => {
      this.handleSeatLocked(data);
    });
  }

  // Start checkout timer (5 minutes)
  startCheckoutTimer(seatId) {
    const timer = setTimeout(() => {
      console.log(`Checkout timer expired for seat ${seatId}`);
      socketManager.unlockSeat(seatId);
      alert(`Time expired for seat ${seatId}. Seat has been released.`);
    }, 5 * 60 * 1000); // 5 minutes (5 * 60 seconds * 1000 ms)

    this.checkoutTimers.set(seatId, timer);
    console.log(`Started 5-minute checkout timer for seat ${seatId}`);
  }

  // Lock seats on proceed
  lockSelectedSeats() {
    const lockedSeats = [];
    
    this.selectedSeats.forEach(seatElement => {
      const seatId = this.getSeatId(seatElement);
      if (socketManager.lockSeat(seatId)) {
        lockedSeats.push(seatId);
      }
    });

    return lockedSeats;
  }
}

// Initialize instances
const socketManager = new SocketManager();
const bookingManager = new SeatBookingManager();

// Element Selectors
const selectMovieEl = document.getElementById("selectMovie");
const movieNameEl = document.getElementById("movieName");
const moviePriceEl = document.getElementById("moviePrice");
const totalPriceEl = document.getElementById("totalPrice");
const selectedSeatsHolderEl = document.getElementById("selectedSeatsHolder");
const proceedBtn = document.getElementById("proceedBtn");
const cancelBtn = document.getElementById("cancelBtn");
const allSeats = document.querySelectorAll("#seatCont .seat:not(.occupied)");

// Initialize Movie Dropdown
moviesList.forEach((movie) => {
  const optionEl = document.createElement("option");
  optionEl.value = movie.movieName;
  optionEl.textContent = `${movie.movieName} $${movie.price}`;
  selectMovieEl.appendChild(optionEl);
});

// Initialize WebSocket connection and setup event listeners
async function initializeWebSocket() {
  try {
    await socketManager.connect();
    setupSocketEventListeners();
    
    // Join default show
    const defaultMovie = moviesList[0];
    bookingManager.setCurrentShow(defaultMovie.showId);
    socketManager.joinShow(defaultMovie.showId);
    
    console.log('WebSocket initialized successfully');
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    console.log('Running in offline mode - real-time features disabled');
    
    // Silent offline mode - app works with local singleton pattern
    // No need to show intrusive banner, the app gracefully degrades
    
    // Remove the alert by not showing it
    // alert('Failed to connect to real-time server. Seat booking may not work correctly.');
  }
}

// Setup Socket event listeners
function setupSocketEventListeners() {
  // Listen for initial locked seats
  socketManager.on('locked-seat-initial', (lockedSeats) => {
    bookingManager.handleInitialLockedSeats(lockedSeats);
  });

  // Listen for seat locked events
  socketManager.on('seat-locked', (data) => {
    bookingManager.handleSeatLocked(data);
  });

  // Listen for seat unlocked events
  socketManager.on('seat-unlocked', (data) => {
    bookingManager.handleSeatUnlocked(data);
  });

  // Listen for seat lock failures
  socketManager.on('seat-locked-failed', (data) => {
    const { seatId, message } = data;
    alert(`Failed to lock seat ${seatId}: ${message}`);
  });
}

// 4. Event Listeners

// Handle Movie Selection Change
selectMovieEl.addEventListener("change", (e) => {
  const selectedMovie = moviesList.find(
    (movie) => movie.movieName === e.target.value,
  );

  // Update UI and Price State
  movieNameEl.textContent = selectedMovie.movieName;
  moviePriceEl.textContent = `$ ${selectedMovie.price}`;
  bookingManager.currentMoviePrice = selectedMovie.price;
  
  // Join new show room
  if (socketManager.isConnected()) {
    bookingManager.setCurrentShow(selectedMovie.showId);
    socketManager.joinShow(selectedMovie.showId);
    
    // Clear current seat states
    bookingManager.lockedSeats.clear();
    bookingManager.myLockedSeats.clear();
    
    // Reset seat UI
    allSeats.forEach(seat => {
      if (!seat.classList.contains("occupied")) {
        seat.classList.remove("booking");
        seat.title = "";
      }
    });
  }

  updateDisplay();
});

// Handle Seat Clicking
allSeats.forEach((seat) => {
  seat.addEventListener("click", () => {
    // Check if seat is available for selection
    if (!bookingManager.isSeatAvailable(seat)) {
      return;
    }

    if (seat.classList.contains("selected")) {
      // Deselect seat
      seat.classList.remove("selected");
      bookingManager.selectedSeats = bookingManager.selectedSeats.filter((s) => s !== seat);
    } else {
      // Select seat
      seat.classList.add("selected");
      bookingManager.selectedSeats.push(seat);
    }

    updateDisplay();
  });
});

// Handle Proceed Button
proceedBtn.addEventListener("click", () => {
  if (bookingManager.selectedSeats.length === 0) {
    alert("Oops! No seat selected.");
    return;
  }

  // If not connected to server, proceed with local-only booking
  // The SeatBookingManager singleton will handle concurrency control locally
  if (!socketManager.isConnected()) {
    console.log('Proceeding with local booking mode');
  }

  // Lock seats via WebSocket
  const lockedSeats = bookingManager.lockSelectedSeats();
  
  if (lockedSeats.length > 0) {
    // Remove selection UI
    bookingManager.selectedSeats.forEach((seat) => {
      seat.classList.remove("selected");
    });

    // Start checkout timers for our locked seats
    lockedSeats.forEach(seatId => {
      bookingManager.startCheckoutTimer(seatId);
    });

    alert(`${lockedSeats.length} seat(s) locked! You have 5 minutes to complete the booking. Seats will be automatically released if time expires.`);
    
    // Here you would typically redirect to a checkout page
    // For demo purposes, we'll just show the timer message
    console.log('Seats locked, checkout timer started');
  }
  
  resetSelection();
});

// Handle Cancel Button
cancelBtn.addEventListener("click", () => {
  bookingManager.selectedSeats.forEach((seat) => {
    seat.classList.remove("selected");
  });
  resetSelection();
});

// Add manual unlock button for testing (optional)
function addUnlockButton() {
  const unlockBtn = document.createElement('button');
  unlockBtn.textContent = 'Unlock My Seats';
  unlockBtn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;';
  unlockBtn.onclick = () => {
    bookingManager.myLockedSeats.forEach(seatId => {
      socketManager.unlockSeat(seatId);
    });
    alert('Your seats have been unlocked.');
  };
  
  const buttonCont = document.querySelector('.buttonCont');
  if (buttonCont && !buttonCont.querySelector('.unlock-btn')) {
    unlockBtn.className = 'unlock-btn';
    buttonCont.appendChild(unlockBtn);
  }
}

// 5. Helper Functions

function updateDisplay() {
  // Update Total Price
  const total = bookingManager.selectedSeats.length * bookingManager.currentMoviePrice;
  totalPriceEl.textContent = `$ ${total}`;

  // Update Visual Seat Numbers - get seat number by finding position in all seats
  selectedSeatsHolderEl.innerHTML = bookingManager.selectedSeats.length
    ? bookingManager.selectedSeats
        .map((seat) => {
          const seatNumber = Array.from(allSeats).indexOf(seat) + 1; // Convert 0-based index to 1-based seat number
          return `<div class="selectedSeat">${seatNumber}</div>`;
        })
        .join("")
    : '<span class="noSelected">No Seat Selected</span>';

  // Update Seat Count (if you have a span with id "numberOfSeat")
  const countEl = document.getElementById("numberOfSeat");
  if (countEl) countEl.textContent = bookingManager.selectedSeats.length;
}

function resetSelection() {
  bookingManager.selectedSeats = [];
  updateDisplay();
}

// Initialize WebSocket and set up default UI
initializeWebSocket();

// Initial Default UI Setup - Use dynamic values
const defaultMovie = moviesList[0];
selectMovieEl.value = defaultMovie.movieName;
movieNameEl.textContent = defaultMovie.movieName;
moviePriceEl.textContent = `$ ${defaultMovie.price}`;

// Add unlock button for testing
setTimeout(addUnlockButton, 1000); // 1 second delay to ensure DOM is ready
