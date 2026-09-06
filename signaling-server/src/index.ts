import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { ClientMessage, ServerMessage } from './types.js';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// Map<roomId, Map<peerId, socket>>
const rooms = new Map<string, Map<string, WebSocket>>();

function send(socket: WebSocket, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}

wss.on('connection', (socket: WebSocket) => {
  const peerId = randomUUID();
  let currentRoomId: string | null = null;

  console.log(`Peer connected: ${peerId}`);

  socket.on('message', (data) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(data.toString());
    } catch {
      console.log('Received invalid JSON, ignoring');
      return;
    }

    if (message.type === 'join-room') {
      const { roomId } = message;

      let room = rooms.get(roomId);
      if (!room) {
        room = new Map();
        rooms.set(roomId, room);
      }

      if (room.size >= 2) {
        send(socket, { type: 'room-full' });
        return;
      }

      // Notify existing peer(s) in the room that a new peer joined
      for (const existingPeerId of room.keys()) {
        const existingSocket = room.get(existingPeerId)!;
        send(existingSocket, { type: 'peer-joined', peerId });
      }

      room.set(peerId, socket);
      currentRoomId = roomId;

      send(socket, { type: 'joined-room', roomId, peerId });
      console.log(`Peer ${peerId} joined room ${roomId} (size: ${room.size})`);
    }
  });

  socket.on('close', () => {
    console.log(`Peer disconnected: ${peerId}`);
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.delete(peerId);
        for (const remainingSocket of room.values()) {
          send(remainingSocket, { type: 'peer-left', peerId });
        }
        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

console.log(`Signaling server listening on ws://localhost:${PORT}`);