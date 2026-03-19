const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from public directory
app.use(express.static('public'));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Data structures
const clients = new Map(); // username -> { ws, sessionId, isAdmin, flag }
const sessions = new Map(); // sessionId -> username
const messageHistory = []; // store all direct messages
const groupChatHistory = []; // store group chat messages
const customRooms = new Map(); // roomId -> { name, creator, members: Set, messages: [], created: timestamp }
const bannedUsers = new Set(); // banned usernames
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Set via Railway env variable

// Helper function to generate room ID
function generateRoomId() {
  return 'room_' + crypto.randomBytes(8).toString('hex');
}

// Helper function to broadcast room list
function broadcastRooms() {
  const roomsList = Array.from(customRooms.entries()).map(([id, room]) => ({
    id,
    name: room.name,
    creator: room.creator,
    memberCount: room.members.size,
    members: Array.from(room.members)
  }));
  
  const message = JSON.stringify({
    type: 'roomsList',
    rooms: roomsList
  });
  
  clients.forEach((clientData) => {
    if (clientData.ws.readyState === WebSocket.OPEN) {
      clientData.ws.send(message);
    }
  });
}

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.send('Pixel Messenger Server is running! 🎮💬');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    uptime: process.uptime(),
    groupMessages: groupChatHistory.length,
    bannedUsers: bannedUsers.size
  });
});

// Generate unique session ID
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

// Broadcast to all connected clients
function broadcast(message, excludeUsername = null) {
  clients.forEach((clientData, username) => {
    if (username !== excludeUsername && clientData.ws.readyState === WebSocket.OPEN) {
      clientData.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastUsers() {
  const users = Array.from(clients.keys());
  const message = {
    type: 'users',
    users: users
  };
  
  broadcast(message);
}

wss.on('connection', (ws) => {
  let username = null;
  let sessionId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'login':
          username = message.username;
          const isAdmin = message.password === ADMIN_PASSWORD;
          const flag = message.flag || '';
          
          // Check if banned
          if (bannedUsers.has(username)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'You have been banned from this server.'
            }));
            ws.close();
            return;
          }
          
          // Check if username is already taken
          if (clients.has(username)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Username already taken. Please choose another name.'
            }));
            return;
          }
          
          // Generate session ID
          sessionId = generateSessionId();
          sessions.set(sessionId, username);
          
          // Store client with flag
          clients.set(username, { ws, sessionId, isAdmin, flag });
          console.log(`${username} connected ${isAdmin ? '(ADMIN)' : ''}`);

          // Send session ID to client
          ws.send(JSON.stringify({
            type: 'session',
            sessionId: sessionId,
            isAdmin: isAdmin
          }));

          // Send group chat history
          ws.send(JSON.stringify({
            type: 'groupHistory',
            messages: groupChatHistory
          }));

          // Send list of online users to all clients
          broadcastUsers();
          
          // Send rooms list to all clients
          broadcastRooms();
          break;

        case 'groupMessage':
          const groupMsg = {
            type: 'groupMessage',
            from: username,
            text: message.text,
            time: new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }),
            timestamp: Date.now()
          };

          // Store in group chat history
          groupChatHistory.push(groupMsg);

          // Broadcast to all users
          broadcast(groupMsg);
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
          const recipientData = clients.get(message.to);
          if (recipientData && recipientData.ws.readyState === WebSocket.OPEN) {
            recipientData.ws.send(JSON.stringify(msg));
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

        // Custom Room handlers
        case 'createRoom':
          const roomId = generateRoomId();
          const newRoom = {
            name: message.roomName,
            creator: username,
            members: new Set([username, ...message.invitedUsers]),
            messages: [],
            created: Date.now()
          };
          
          customRooms.set(roomId, newRoom);
          console.log(`Room "${message.roomName}" created by ${username}`);
          
          // Notify creator
          ws.send(JSON.stringify({
            type: 'roomCreated',
            roomId: roomId,
            room: {
              id: roomId,
              name: newRoom.name,
              creator: newRoom.creator,
              members: Array.from(newRoom.members)
            }
          }));
          
          // Broadcast updated room list
          broadcastRooms();
          break;

        case 'joinRoom':
          const joinRoom = customRooms.get(message.roomId);
          if (joinRoom) {
            joinRoom.members.add(username);
            
            // Send room history to joining user
            ws.send(JSON.stringify({
              type: 'roomHistory',
              roomId: message.roomId,
              messages: joinRoom.messages
            }));
            
            broadcastRooms();
          }
          break;

        case 'leaveRoom':
          const leaveRoom = customRooms.get(message.roomId);
          if (leaveRoom) {
            leaveRoom.members.delete(username);
            
            // Delete room if empty
            if (leaveRoom.members.size === 0) {
              customRooms.delete(message.roomId);
              console.log(`Room "${leaveRoom.name}" auto-deleted (empty)`);
            }
            
            broadcastRooms();
          }
          break;

        case 'roomMessage':
          const room = customRooms.get(message.roomId);
          if (room && room.members.has(username)) {
            const roomMsg = {
              type: 'roomMessage',
              roomId: message.roomId,
              from: username,
              text: message.text,
              time: new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              }),
              timestamp: Date.now()
            };
            
            // Store in room history
            room.messages.push(roomMsg);
            
            // Send to all room members
            room.members.forEach(memberName => {
              const memberData = clients.get(memberName);
              if (memberData && memberData.ws.readyState === WebSocket.OPEN) {
                memberData.ws.send(JSON.stringify(roomMsg));
              }
            });
          }
          break;

        case 'deleteRoom':
          const delAdminData = clients.get(username);
          if (!delAdminData || !delAdminData.isAdmin) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Admin privileges required'
            }));
            return;
          }
          
          const roomToDelete = customRooms.get(message.roomId);
          if (roomToDelete) {
            // Notify all members
            roomToDelete.members.forEach(memberName => {
              const memberData = clients.get(memberName);
              if (memberData && memberData.ws.readyState === WebSocket.OPEN) {
                memberData.ws.send(JSON.stringify({
                  type: 'roomDeleted',
                  roomId: message.roomId,
                  message: `Room "${roomToDelete.name}" was deleted by admin`
                }));
              }
            });
            
            customRooms.delete(message.roomId);
            console.log(`Room "${roomToDelete.name}" deleted by admin ${username}`);
            broadcastRooms();
          }
          break;

        // Admin actions
        case 'adminKick':
          const clientData = clients.get(username);
          if (!clientData || !clientData.isAdmin) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Admin privileges required'
            }));
            return;
          }

          const targetUser = message.targetUsername;
          const targetData = clients.get(targetUser);
          
          if (targetData) {
            // Notify target user
            targetData.ws.send(JSON.stringify({
              type: 'kicked',
              message: 'You have been kicked by an admin'
            }));
            
            // Close connection
            targetData.ws.close();
            clients.delete(targetUser);
            sessions.delete(targetData.sessionId);
            
            console.log(`${targetUser} was kicked by ${username}`);
            broadcastUsers();
            
            // Notify admin
            ws.send(JSON.stringify({
              type: 'adminAction',
              action: 'kick',
              success: true,
              target: targetUser
            }));
          }
          break;

        case 'adminBan':
          const adminData = clients.get(username);
          if (!adminData || !adminData.isAdmin) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Admin privileges required'
            }));
            return;
          }

          const banTarget = message.targetUsername;
          bannedUsers.add(banTarget);
          
          const banTargetData = clients.get(banTarget);
          if (banTargetData) {
            // Notify and disconnect
            banTargetData.ws.send(JSON.stringify({
              type: 'banned',
              message: 'You have been banned by an admin'
            }));
            
            banTargetData.ws.close();
            clients.delete(banTarget);
            sessions.delete(banTargetData.sessionId);
            broadcastUsers();
          }
          
          console.log(`${banTarget} was banned by ${username}`);
          
          ws.send(JSON.stringify({
            type: 'adminAction',
            action: 'ban',
            success: true,
            target: banTarget
          }));
          break;

        case 'adminClearGroupChat':
          const clearAdminData = clients.get(username);
          if (!clearAdminData || !clearAdminData.isAdmin) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Admin privileges required'
            }));
            return;
          }

          // Clear group chat history
          groupChatHistory.length = 0;
          
          console.log(`Group chat cleared by ${username}`);
          
          // Notify all users
          broadcast({
            type: 'groupChatCleared',
            clearedBy: username
          });
          
          ws.send(JSON.stringify({
            type: 'adminAction',
            action: 'clearGroupChat',
            success: true
          }));
          break;

        case 'adminUnban':
          const unbanAdminData = clients.get(username);
          if (!unbanAdminData || !unbanAdminData.isAdmin) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Admin privileges required'
            }));
            return;
          }

          const unbanTarget = message.targetUsername;
          bannedUsers.delete(unbanTarget);
          
          console.log(`${unbanTarget} was unbanned by ${username}`);
          
          ws.send(JSON.stringify({
            type: 'adminAction',
            action: 'unban',
            success: true,
            target: unbanTarget
          }));
          break;

        case 'adminGetBannedUsers':
          const getBanAdminData = clients.get(username);
          if (!getBanAdminData || !getBanAdminData.isAdmin) {
            return;
          }

          ws.send(JSON.stringify({
            type: 'bannedUsersList',
            users: Array.from(bannedUsers)
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
      if (sessionId) {
        sessions.delete(sessionId);
      }
      console.log(`${username} disconnected`);
      broadcastUsers();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Pixel Messenger Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🔐 Admin password: ${ADMIN_PASSWORD}`);
  console.log('Waiting for connections...');
});