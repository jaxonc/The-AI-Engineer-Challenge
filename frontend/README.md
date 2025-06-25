# OpenAI Chat Frontend

A modern, responsive Next.js frontend for the OpenAI Chat API built with TypeScript and Tailwind CSS.

## Features

- 🎨 Modern, responsive UI with dark/light mode support
- 🔒 Secure API key input (password field)
- 🚀 Real-time streaming responses from OpenAI
- 📱 Mobile-friendly design
- ⚡ Built with Next.js 14 and TypeScript
- 🎯 Tailwind CSS for styling

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- FastAPI backend running (see `/api` directory)

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development Mode

1. Start the development server:
```bash
npm run dev
```

2. Make sure your FastAPI backend is running on `http://localhost:8000`

3. Open your browser and visit: `http://localhost:3000`

### Production Build

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Configuration

### Environment Variables

Create a `.env.local` file in the frontend directory to configure the FastAPI backend URL:

```bash
FASTAPI_URL=http://localhost:8000
```

For production deployment, set this to your deployed FastAPI backend URL.

## Usage

1. **API Key**: Enter your OpenAI API key in the password field
2. **Model Selection**: Choose from available OpenAI models (GPT-4o, GPT-4o Mini, GPT-3.5 Turbo)
3. **Developer Message**: Enter system instructions or context for the AI
4. **User Message**: Enter your actual question or prompt
5. **Send Message**: Click to send and watch the streaming response appear in real-time

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set the environment variable `FASTAPI_URL` to your deployed FastAPI backend URL
3. Deploy automatically with git pushes

### Manual Deployment

1. Build the application: `npm run build`
2. Deploy the `.next` folder to your hosting provider
3. Ensure your hosting provider supports Node.js applications

## API Integration

The frontend communicates with the FastAPI backend through:
- **Endpoint**: `/api/chat`
- **Method**: POST
- **Body**: JSON with `developer_message`, `user_message`, `model`, and `api_key`
- **Response**: Streaming text response

## Project Structure

```
frontend/
├── app/
│   ├── api/chat/
│   │   └── route.ts          # API proxy to FastAPI backend
│   ├── globals.css           # Global styles
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Main chat interface
├── package.json             # Dependencies and scripts
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Technologies Used

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **React Hooks**: State management and effects

## Troubleshooting

### Common Issues

1. **API Connection Errors**: Ensure the FastAPI backend is running on the correct port
2. **CORS Issues**: The FastAPI backend should have CORS middleware configured
3. **Build Errors**: Make sure all dependencies are installed with `npm install`

### Network Configuration

If running on different ports or hosts, update the `FASTAPI_URL` environment variable accordingly.