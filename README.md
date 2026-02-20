# 🎮 Pixel Messenger - Real-Time Chat App

A retro pixel-art styled messenger with real-time communication using WebSockets.

## 🚀 Quick Deploy to Railway

Want to deploy this to the internet? Check out **[RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)** for step-by-step instructions!

## 🏠 Local Setup

### 1. Start the Server

Open a terminal and run:

```bash
cd /path/to/project
npm install
npm start
```

The server will start on `http://localhost:3001`

### 2. Setup the Frontend

**Option A: Use in React project**
- Copy `messenger-app.jsx` to your React app
- Create `.env` file with: `VITE_WS_URL=ws://localhost:3001`
- Import and use: `import PixelMessenger from './messenger-app'`

**Option B: Quick test with Vite**
```bash
npm create vite@latest pixel-chat -- --template react
cd pixel-chat
npm install
npm install lucide-react

# Create .env file
echo "VITE_WS_URL=ws://localhost:3001" > .env

# Replace src/App.jsx with messenger-app.jsx content
npm run dev
```

### 3. Test with Multiple Users

1. Open the app in **two different browsers**
2. Enter different usernames in each
3. Start chatting in real-time!

## 🌐 Production Deployment

### Railway (Recommended)
1. Push code to GitHub
2. Connect to Railway
3. Get your WebSocket URL (e.g., `wss://your-app.up.railway.app`)
4. Update frontend `.env`: `VITE_WS_URL=wss://your-app.up.railway.app`

See **[RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)** for detailed instructions.

### Other Platforms
- **Render**: Works great, similar to Railway
- **Heroku**: Update `Procfile` with `web: node server.js`
- **Fly.io**: Add `fly.toml` configuration

## ✨ Features

- **Real-time messaging** - Instant message delivery
- **Online user list** - See who's currently online
- **Message history** - Conversations persist during session
- **Retro pixel art design** - Pink/yellow color scheme
- **Fixed viewport height** - Clean, no-scroll interface
- **Responsive layout** - Works on all screen sizes
- **Health monitoring** - `/health` endpoint for status checks

## 🎨 Design

Based on retro pixel art style with:
- Pink (#ff6b9d) to orange (#ffa94d) gradients
- Yellow (#ffe066) accent buttons
- Black borders and shadows
- Press Start 2P pixel font
- Rounded corners with pixel aesthetic

## 🔧 Tech Stack

- **Frontend**: React with hooks
- **Backend**: Node.js + Express + WebSocket (ws)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Railway-ready

## 📝 How It Works

1. **Login**: Users enter a username
2. **WebSocket Connection**: Client connects to server
3. **User List**: Server broadcasts all online users
4. **Messaging**: Real-time message delivery
5. **History**: Messages stored per conversation

## 🔒 Environment Variables

### Frontend (.env)
```
VITE_WS_URL=ws://localhost:3001  # Local
VITE_WS_URL=wss://your-app.up.railway.app  # Production
```

### Backend (Railway sets automatically)
```
PORT=3001  # Railway assigns this automatically
```

## 🐛 Troubleshooting

**Local Development:**
- Make sure server is running on port 3001
- Use `ws://` for local (not `wss://`)
- Check browser console for errors

**Railway Production:**
- Use `wss://` (secure WebSocket)
- Verify Railway app is deployed
- Check Railway logs for server errors
- First connection may take a few seconds (cold start)

## 📊 API Endpoints

- `GET /` - Server status message
- `GET /health` - Health check (returns JSON with stats)
- `WebSocket /` - WebSocket connection for real-time chat

## 🎮 Usage Tips

- Open multiple browsers to test locally
- Use Incognito mode for second user
- Messages clear when server restarts
- Railway free tier gives 500 hours/month

## 📦 File Structure

```
pixel-messenger/
├── server.js           # WebSocket server
├── package.json        # Dependencies
├── messenger-app.jsx   # React frontend
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore rules
├── README.md           # This file
└── RAILWAY_DEPLOY.md   # Railway deployment guide
```

Enjoy chatting! 💬✨