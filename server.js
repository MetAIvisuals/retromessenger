const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const clients = new Map(); // username -> ws connection
const messageHistory = []; // store all messages

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.send('Pixel Messenger Server is running! 🎮💬');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    uptime: process.uptime()
  });
});

wss.on('connection', (ws) => {
  let username = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'login':
          username = message.username;
          clients.set(username, ws);
          console.log(`${username} connected`);

          // Send list of online users to all clients
          broadcastUsers();
          break;

        case 'message':
          const msg = {
            type: 'message',
            from: username,
            to: message.to,
            text: message.text,
            time: new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })
          };

          // Store message in history
          messageHistory.push(msg);

          // Send to recipient
          const recipientWs = clients.get(message.to);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify(msg));
          }

          // Echo back to sender
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
          break;

        case 'getHistory':
          // Send message history between two users
          const history = messageHistory.filter(msg => 
            (msg.from === username && msg.to === message.with) ||
            (msg.from === message.with && msg.to === username)
          );
          
          ws.send(JSON.stringify({
            type: 'history',
            messages: history
          }));
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (username) {
      clients.delete(username);
      console.log(`${username} disconnected`);
      broadcastUsers();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function broadcastUsers() {
  const users = Array.from(clients.keys());
  const message = JSON.stringify({
    type: 'users',
    users: users
  });

  clients.forEach((clientWs) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(message);
    }
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Pixel Messenger Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log('Waiting for connections...');
});