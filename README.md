# Modern Chat Application

A real-time chat application with a modern, responsive interface inspired by Slack/Discord.

## Features

- Real-time messaging with WebSocket
- User authentication
- Message read receipts
- Reply to messages
- Profile picture management
- Dark/Light theme support
- Responsive design
- Typing indicators

## Prerequisites

- Node.js (v20 recommended)
- npm (comes with Node.js)

## Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
# Development environment
NODE_ENV=development

# Server configuration
PORT=3000
HOST=localhost

# Session secret (change this to a secure random string)
SESSION_SECRET=your_secure_secret_here
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Development

The project uses the following tech stack:
- React with TypeScript
- Express.js backend
- WebSocket for real-time communication
- TanStack Query for data fetching
- Tailwind CSS for styling
- Framer Motion for animations
- Shadcn UI components

## Project Structure

```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # Utility functions and configurations
│   │   └── pages/      # Application pages
├── server/              # Backend Express application
│   ├── auth.ts         # Authentication setup
│   ├── routes.ts       # API routes
│   └── storage.ts      # Data storage implementation
└── shared/             # Shared types and schemas
    └── schema.ts       # Database schema and types
```

## Available Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the production version
- `npm run start`: Start the production server

## Local Development Notes

- The application uses in-memory storage by default for development
- WebSocket connections are automatically handled
- User sessions persist for 24 hours
- The development server includes hot reloading for both frontend and backend changes

## Authentication

The application uses session-based authentication with the following endpoints:
- POST `/api/register`: Register a new user
- POST `/api/login`: Log in an existing user
- POST `/api/logout`: Log out the current user
- GET `/api/user`: Get the current user's information

## WebSocket Events

The application uses WebSocket for real-time features:
- `init`: Initialize the WebSocket connection with user ID
- `typing`: Send and receive typing indicators
- `ping`: Keep the connection alive