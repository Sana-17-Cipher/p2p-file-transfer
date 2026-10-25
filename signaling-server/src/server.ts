import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { CloseCode } from "./types.js";
import type { ClientMessage, ServerMessage } from "./types.js";

interface Options {
  port: number;
  allowedOrigins: string[];
  heartbeatMs?: number;
}

interface Peer {
  id: string;
  ws: WebSocket;
  roomId: string | null;
  alive: boolean;
}

const MAX_PEERS = 2;

export async function startServer({ port, allowedOrigins, heartbeatMs = 10_000 }: Options) {
  const rooms = new Map<string, Map<string, Peer>>();
  const wss = new WebSocketServer({ port });
  await new Promise<void>((resolve) => wss.once("listening", resolve));

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function joinRoom(peer: Peer, roomId: unknown) {
    if (typeof roomId !== "string" || !roomId.trim() || peer.roomId) {
      peer.ws.close(CloseCode.BadMessage, "bad join");
      return;
    }
    let room = rooms.get(roomId);
    if (!room) {
      room = new Map();
      rooms.set(roomId, room);
    }
    if (room.size >= MAX_PEERS) {
      peer.ws.close(CloseCode.RoomFull, "room full");
      return;
    }
    const others = [...room.keys()];
    room.set(peer.id, peer);
    peer.roomId = roomId;

    send(peer.ws, { type: "joined", peerId: peer.id, peers: others });
    for (const other of room.values()) {
      if (other.id !== peer.id) send(other.ws, { type: "peer-joined", peerId: peer.id });
    }
  }

  function leaveRoom(peer: Peer) {
    if (!peer.roomId) return;
    const room = rooms.get(peer.roomId);
    if (!room) return;
    room.delete(peer.id);
    if (room.size === 0) rooms.delete(peer.roomId);
    for (const other of room.values()) {
      send(other.ws, { type: "peer-left", peerId: peer.id });
    }
    peer.roomId = null;
  }

  function relay(
    peer: Peer,
    msg: Extract<ClientMessage, { type: "offer" | "answer" | "ice-candidate" }>
  ) {
    if (!peer.roomId) return;
    const room = rooms.get(peer.roomId);
    if (!room) return;
    for (const other of room.values()) {
      if (other.id === peer.id) continue;
      if (msg.type === "ice-candidate") {
        send(other.ws, { type: "ice-candidate", from: peer.id, candidate: msg.candidate });
      } else {
        send(other.ws, { type: msg.type, from: peer.id, sdp: msg.sdp });
      }
    }
  }

  wss.on("connection", (ws, req) => {
    if (!allowedOrigins.includes(req.headers.origin ?? "")) {
      ws.close(CloseCode.OriginNotAllowed, "origin not allowed");
      return;
    }

    const peer: Peer = { id: randomUUID(), ws, roomId: null, alive: true };

    ws.on("pong", () => {
      peer.alive = true;
    });

    ws.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        ws.close(CloseCode.BadMessage, "invalid json");
        return;
      }
      switch (msg?.type) {
        case "join-room":
          return joinRoom(peer, msg.roomId);
        case "offer":
        case "answer":
        case "ice-candidate":
          return relay(peer, msg);
        default:
          ws.close(CloseCode.BadMessage, "unknown message type");
      }
    });

    ws.on("close", () => leaveRoom(peer));
    ws.on("error", () => ws.terminate());
  });

  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      for (const p of room.values()) {
        if (!p.alive) {
          p.ws.terminate();
          continue;
        }
        p.alive = false;
        p.ws.ping();
      }
    }
  }, heartbeatMs);

  return {
    port: (wss.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(timer);
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}