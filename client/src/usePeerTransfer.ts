import { useEffect, useRef, useState } from "react";

const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL ?? "ws://localhost:8080";
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const CHUNK_SIZE = 16 * 1024;
const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;
const HEADER = 4 + 32; // 4-byte chunk index + 32-byte SHA-256

export type Status = "idle" | "waiting" | "negotiating" | "connected" | "failed";

type ServerMessage =
  | { type: "joined"; peerId: string; peers: string[] }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | { type: "offer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; from: string; candidate: RTCIceCandidateInit };

interface Meta {
  kind: "meta";
  name: string;
  size: number;
  mime: string;
  total: number;
}

export interface Received {
  name: string;
  url: string;
  verified: boolean;
}

async function digest(buf: ArrayBuffer): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

function waitForDrain(dc: RTCDataChannel): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      dc.removeEventListener("bufferedamountlow", handler);
      resolve();
    };
    dc.addEventListener("bufferedamountlow", handler);
  });
}

export function usePeerTransfer() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [received, setReceived] = useState<Received | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const incoming = useRef<{
    meta: Meta;
    chunks: (ArrayBuffer | undefined)[];
    count: number;
    bad: number;
  } | null>(null);

  const roomRef = useRef("");
  const manualClose = useRef(false);
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const addLog = (line: string) => setLog((l) => [...l.slice(-49), line]);

  const signal = (msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  async function finishReceive() {
    const inc = incoming.current;
    if (!inc) return;
    incoming.current = null;
    const blob = new Blob(inc.chunks as ArrayBuffer[], { type: inc.meta.mime });
    const verified = inc.bad === 0;
    setReceived({ name: inc.meta.name, url: URL.createObjectURL(blob), verified });
    addLog(
      verified
        ? `Received ${inc.meta.name} (all chunks verified)`
        : `Received ${inc.meta.name} (${inc.bad} BAD CHUNKS)`
    );
  }

  async function handleChannelMessage(ev: MessageEvent) {
    if (typeof ev.data === "string") {
      const meta = JSON.parse(ev.data) as Meta;
      if (meta.kind !== "meta") return;
      incoming.current = { meta, chunks: new Array(meta.total), count: 0, bad: 0 };
      setReceived(null);
      setProgress(0);
      addLog(`Receiving ${meta.name} (${meta.size} bytes)`);
      if (meta.total === 0) await finishReceive();
      return;
    }

    const inc = incoming.current;
    if (!inc) return;
    const data = ev.data as ArrayBuffer;
    const index = new DataView(data).getUint32(0);
    if (index >= inc.meta.total) {
      inc.bad++;
      return;
    }
    const expected = new Uint8Array(data, 4, 32);
    const payload = data.slice(HEADER);
    const actual = await digest(payload);
    if (!expected.every((b, i) => b === actual[i])) inc.bad++;

    inc.chunks[index] = payload;
    inc.count++;
    setProgress(Math.round((inc.count / inc.meta.total) * 100));
    if (inc.count === inc.meta.total) await finishReceive();
  }

  function setupChannel(dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = LOW_WATER;
    dc.onopen = () => {
      setStatus("connected");
      addLog("Data channel open");
    };
    dc.onclose = () => addLog("Data channel closed");
    dc.onmessage = (ev) => void handleChannelMessage(ev);
    dcRef.current = dc;
  }

  function createPeerConnection() {
    pcRef.current?.close();
    pendingCandidates.current = [];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) signal({ type: "ice-candidate", candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      addLog(`Connection: ${pc.connectionState}`);
      if (pc.connectionState === "failed") setStatus("failed");
    };
    pc.ondatachannel = (e) => setupChannel(e.channel);
    pcRef.current = pc;
    return pc;
  }

  async function flushCandidates(pc: RTCPeerConnection) {
    for (const c of pendingCandidates.current) await pc.addIceCandidate(c);
    pendingCandidates.current = [];
  }

  async function handleSignal(msg: ServerMessage) {
    switch (msg.type) {
      case "joined":
        setStatus(msg.peers.length > 0 ? "negotiating" : "waiting");
        addLog(msg.peers.length > 0 ? "Joined; waiting for offer" : "Joined; waiting for a peer");
        break;

      case "peer-joined": {
        setStatus("negotiating");
        const pc = createPeerConnection();
        setupChannel(pc.createDataChannel("file"));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signal({ type: "offer", sdp: pc.localDescription });
        break;
      }

      case "offer": {
        const pc = createPeerConnection();
        await pc.setRemoteDescription(msg.sdp);
        await flushCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signal({ type: "answer", sdp: pc.localDescription });
        break;
      }

      case "answer": {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(msg.sdp);
        await flushCandidates(pc);
        break;
      }

      case "ice-candidate": {
        const pc = pcRef.current;
        if (pc?.remoteDescription) await pc.addIceCandidate(msg.candidate);
        else pendingCandidates.current.push(msg.candidate);
        break;
      }

      case "peer-left":
        pcRef.current?.close();
        pcRef.current = null;
        dcRef.current = null;
        setStatus("waiting");
        addLog("Peer left");
        break;
    }
  }

  function connect() {
    const ws = new WebSocket(SIGNAL_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      attempt.current = 0;
      ws.send(JSON.stringify({ type: "join-room", roomId: roomRef.current }));
    };

    ws.onmessage = (ev) => {
      handleSignal(JSON.parse(ev.data) as ServerMessage).catch((err) => addLog(`Error: ${err}`));
    };

    ws.onclose = (ev) => {
      if (wsRef.current !== ws || manualClose.current) return; // old socket, or user left
      if (ev.code === 4001) addLog("Room is full");
      else if (ev.code === 4002) addLog("Bad message");
      else if (ev.code === 4003) addLog("Origin not allowed");
      if (ev.code >= 4001 && ev.code <= 4003) {
        setStatus("idle");
        return; // rejected on purpose, so don't retry
      }
      const cap = Math.min(30_000, 1000 * 2 ** attempt.current++);
      const delay = cap / 2 + Math.random() * (cap / 2); // jitter
      addLog(`Signaling lost; retrying in ${Math.round(delay / 1000)}s`);
      retryTimer.current = setTimeout(connect, delay);
    };
  }

  function join(roomId: string) {
    leave();
    manualClose.current = false;
    roomRef.current = roomId;
    connect();
  }

  function leave() {
    manualClose.current = true;
    clearTimeout(retryTimer.current);
    wsRef.current?.close();
    pcRef.current?.close();
    wsRef.current = pcRef.current = dcRef.current = null;
    setStatus("idle");
    setProgress(0);
  }

  async function sendFile(file: File) {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    const total = Math.ceil(file.size / CHUNK_SIZE);
    const meta: Meta = { kind: "meta", name: file.name, size: file.size, mime: file.type, total };
    dc.send(JSON.stringify(meta));
    addLog(`Sending ${file.name}`);
    setProgress(0);

    for (let i = 0; i < total; i++) {
      const chunk = await file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).arrayBuffer();
      const hash = await digest(chunk);
      const frame = new Uint8Array(HEADER + chunk.byteLength);
      new DataView(frame.buffer).setUint32(0, i);
      frame.set(hash, 4);
      frame.set(new Uint8Array(chunk), HEADER);

      if (dc.bufferedAmount > HIGH_WATER) await waitForDrain(dc);
      dc.send(frame);
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    addLog("Sent");
  }

  useEffect(() => leave, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, progress, log, received, join, leave, sendFile };
}