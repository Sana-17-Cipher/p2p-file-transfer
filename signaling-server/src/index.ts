import { WebSocketServer, WebSocket } from 'ws';

const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket: WebSocket) => {
  console.log('A client connected');

  socket.send('Hello from server!');

  socket.on('message', (data) => {
    console.log('Received:', data.toString());
  });

  socket.on('close', () => {
    console.log('A client disconnected');
  });
});

console.log(`Signaling server listening on ws://localhost:${PORT}`);