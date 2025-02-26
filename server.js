const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { VM } = require('vm2');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();

app.use(express.static('public'));

// Routes
app.get('/battle/:roomId', (req, res) => {
  res.sendFile(__dirname + '/public/battle.html');
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('joinRoom', (roomId, username) => {
    currentRoom = roomId;
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        code: 'function sort(arr) {\n  return arr.sort((a,b) => a - b);\n}',
        players: new Map(),
        battleActive: false,
        testArray: null
      });
    }
    
    // Send current code to new participant
    socket.emit('codeUpdate', rooms.get(roomId).code);
  });

  socket.on('codeChange', (newCode) => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).code = newCode;
      socket.to(currentRoom).emit('codeUpdate', newCode);
    }
  });

  socket.on('startBattle', async () => {
    const room = rooms.get(currentRoom);
    room.testArray = Array.from({length: 100}, () => Math.floor(Math.random() * 1000));
    
    // Countdown sequence
    for (let i = 3; i > 0; i--) {
      io.to(currentRoom).emit('battleCountdown', i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    io.to(currentRoom).emit('battleStart', room.testArray);
  });

  socket.on('runCode', (code) => {
    const room = rooms.get(currentRoom);
    try {
      const vm = new VM({
        timeout: 2000,
        sandbox: { steps: [] }
      });

      const start = Date.now();
      const result = vm.run(`(${code})([...${JSON.stringify(room.testArray)}])`);
      const time = Date.now() - start;

      socket.emit('executionResult', {
        success: true,
        time: time,
        array: result
      });
    } catch (error) {
      socket.emit('executionResult', {
        success: false,
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) rooms.get(currentRoom).players.delete(socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running: http://localhost:3000');
});