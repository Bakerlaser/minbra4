const express = require('express');
const ip = require('ip');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.send('✅ سيرفر مين برا السالفة يعمل!');
});

// State management
const rooms = {};

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit code
    } while (rooms[code]);
    return code;
}

io.on('connection', (socket) => {

    socket.on('createRoom', (playerName, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            id: roomCode,
            hostId: socket.id,
            players: [{ id: socket.id, name: playerName, role: 'normal', score: 0, hintPoints: 100, word: '', votedFor: null }],
            settings: { rounds: 3, spiesCount: 1, useHelper: false, useDoubleAgent: false, useForbiddenWords: false, selectedCategory: null },
            state: { phase: 'lobby', currentRound: 0, currentWord: '', spyIndices: [], helperIndex: -1 } // lobby, reveal, playing, voting, suspense, spyGuess, roundResults, finalResults
        };
        socket.join(roomCode);
        socket.roomId = roomCode;
        socket.playerName = playerName;
        callback({ success: true, roomCode, room: rooms[roomCode] });
    });

    socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, message: 'الغرفة غير موجودة!' });
        if (room.state.phase !== 'lobby') return callback({ success: false, message: 'اللعبة بدأت بالفعل!' });
        if (room.players.length >= 12) return callback({ success: false, message: 'الغرفة ممتلئة!' });
        if (room.players.some(p => p.name === playerName)) return callback({ success: false, message: 'الاسم مستخدم في هذه الغرفة!' });

        const playerObj = { id: socket.id, name: playerName, role: 'normal', score: 0, hintPoints: 100, word: '', votedFor: null };
        room.players.push(playerObj);
        socket.join(roomCode);
        socket.roomId = roomCode;
        socket.playerName = playerName;

        callback({ success: true, room });
        io.to(roomCode).emit('playerJoined', room.players);
    });

    // Host updates settings
    socket.on('updateSettings', (newSettings) => {
        const room = rooms[socket.roomId];
        if (room && room.hostId === socket.id) {
            room.settings = { ...room.settings, ...newSettings };
            // broadcast to others (or everyone)
            socket.to(socket.roomId).emit('settingsUpdated', room.settings);
        }
    });

    // Host kicks player
    socket.on('kickPlayer', (playerId) => {
        const room = rooms[socket.roomId];
        if (room && room.hostId === socket.id) {
            room.players = room.players.filter(p => p.id !== playerId);
            io.to(socket.roomId).emit('playerLeft', room.players);
            // make the kicked socket leave the room
            const kickedSocket = io.sockets.sockets.get(playerId);
            if (kickedSocket) {
                kickedSocket.leave(socket.roomId);
                kickedSocket.emit('kicked');
                kickedSocket.roomId = null;
            }
        }
    });

    // Server-relayed game events from Host
    socket.on('hostEvent', (data) => {
        const room = rooms[socket.roomId];
        if (room && room.hostId === socket.id) {
            // Update server state if needed based on event type
            if (data.type === 'gameStateUpdate') {
                room.state = { ...room.state, ...data.state };
                room.players = data.players;
            }
            // Broadcast to other players in the room
            socket.to(socket.roomId).emit('gameEvent', data);
        }
    });

    // Events from clients to Host (like submitting a vote)
    socket.on('clientEvent', (data) => {
        const room = rooms[socket.roomId];
        if (room) {
            // Send to Host only
            io.to(room.hostId).emit('clientEvent', { ...data, playerId: socket.id, playerName: socket.playerName });
        }
    });

    socket.on('disconnect', () => {
        if (socket.roomId && rooms[socket.roomId]) {
            const room = rooms[socket.roomId];
            room.players = room.players.filter(p => p.id !== socket.id);

            if (room.players.length === 0) {
                delete rooms[socket.roomId]; // Clean up empty rooms
            } else {
                if (room.hostId === socket.id) {
                    // Assign new host
                    room.hostId = room.players[0].id;
                    io.to(room.hostId).emit('youAreHost');
                }
                io.to(socket.roomId).emit('playerLeft', room.players);
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const localIp = ip.address();
    console.log('=====================================================');
    console.log('🎉 لعبة "مين برا السالفة" (أونلاين) تعمل الآن! 🎉');
    console.log('=====================================================');
    console.log('');
    console.log('🌐 للعب محلياً افتح الرابط التالي:');
    console.log(`➡️  http://localhost:${PORT}`);
    console.log('');
    console.log('📱 للعب عبر الشبكة:');
    console.log(`➡️  http://${localIp}:${PORT}`);
    console.log('');
    console.log('=====================================================');
});
