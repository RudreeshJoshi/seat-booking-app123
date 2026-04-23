# Seat Booking Application

A modern seat booking application demonstrating concurrency control and singleton design pattern.

## Features

- **Singleton Design Pattern**: Ensures only one instance of the booking manager
- **Concurrency Control**: Prevents double booking with 45-90 second booking process
- **Color-Coded States**:
  - White: Available seats
  - Green: Selected seats
  - Blue: Booking in progress (45-90 seconds)
  - Grey: Occupied seats
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live seat status updates

## How to Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

## Deployment

### Heroku
1. Install Heroku CLI
2. Login to Heroku: `heroku login`
3. Create app: `heroku create your-app-name`
4. Deploy: `git push heroku main`

### Vercel
1. Install Vercel CLI
2. Deploy: `vercel`

### Netlify
1. Drag and drop the project folder to Netlify
2. Or use Netlify CLI: `netlify deploy --prod`

## Concurrency Control Demonstration

The application demonstrates concurrency control through:

1. **Booking Process**: When you click "Continue", seats enter a blue "booking" state for 45-90 seconds
2. **Singleton Pattern**: Ensures consistent state management across the application
3. **Prevention of Double Booking**: Seats in booking state cannot be selected by other users
4. **Automatic Completion**: After the booking period, seats automatically become occupied

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Design Patterns**: Singleton
- **Styling**: Custom CSS with responsive design

## Color Scheme

- **White** (#ffffff): Available seats
- **Blue** (#2196f3): Booking in progress
- **Green** (#4caf50): Selected seats
- **Grey** (#9e9e9e): Occupied seats
