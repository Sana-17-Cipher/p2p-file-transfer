import { useEffect, useRef, useState } from "react";

const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL ?? "ws://localhost:8080";
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const CHUNK_SIZE = 16 * 1024;
const HIGH_WATER = 1024 * 1024;
const LOW_WATER = 256 * 1024;

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
  sha256: string;
}

export interface Received {
  name: string;
  url: string;
  verified: boolean;
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const incoming = useRef<{ meta: Meta; chunks: ArrayBuffer[] } | null>(null);

  const addLog = (line: string) => setLog((l) => [...l.slice(-49), line]);

  const signal = (msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  async function finishReceive() {
    const inc = incoming.current;
    if (!inc) return;
    const blob = new Blob(inc.chunks, { type: inc.meta.mime });
    const hash = await sha256(await blob.arrayBuffer());
    const verified = hash === inc.meta.sha256;
    setReceived({ name: inc.meta.name, url: URL.createObjectURL(blob), verified });
    addLog(verified ? `Received ${inc.meta.name} (hash verified)` : `Received ${inc.meta.name} (HASH MISMATCH)`);
    incoming.current = null;
  }

  function handleChannelMessage(ev: MessageEvent) {
    if (typeof ev.data === "string") {
      const meta = JSON.parse(ev.data) as Meta;
      if (meta.kind !== "meta") return;
      incoming.current = { meta, chunks: [] };
      setReceived(null);
      setProgress(0);
      addLog(`Receiving ${meta.name} (${meta.size} bytes)`);
      if (meta.total === 0) void finishReceive();
      return;
    }
    const inc = incoming.current;
    if (!inc) return;
    inc.chunks.push(ev.data as ArrayBuffer);
    setProgress(Math.round((inc.chunks.length / inc.meta.total) * 100));
    if (inc.chunks.length === inc.meta.total) void finishReceive();
  }

  function setupChannel(dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = LOW_WATER;
    dc.onopen = () => {
      setStatus("connected");
      addLog("Data channel open");
    };
    dc.onclose = () => addLog("Data channel closed");
    dc.onmessage = handleChannelMessage;
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
        // We were here first, so we start the handshake
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

  function join(roomId: string) {
    leave();
    const ws = new WebSocket(SIGNAL_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "join-room", roomId }));
    ws.onmessage = (ev) => {
      handleSignal(JSON.parse(ev.data) as ServerMessage).catch((err) => addLog(`Error: ${err}`));
    };
    ws.onclose = (ev) => {
      if (ev.code === 4001) addLog("Room is full");
      else if (ev.code === 4003) addLog("Origin not allowed");
      else if (ev.code === 4002) addLog("Bad message");
      setStatus((s) => (s === "connected" ? s : "idle"));
    };
  }

  function leave() {
    wsRef.current?.close();
    pcRef.current?.close();
    wsRef.current = pcRef.current = dcRef.current = null;
    setStatus("idle");
    setProgress(0);
  }

  async function sendFile(file: File) {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    const buf = await file.arrayBuffer();
    const total = Math.ceil(buf.byteLength / CHUNK_SIZE);
    const meta: Meta = {
      kind: "meta",
      name: file.name,
      size: file.size,
      mime: file.type,
      total,
      sha256: await sha256(buf),
    };
    dc.send(JSON.stringify(meta));
    addLog(`Sending ${file.name}`);
    setProgress(0);
    for (let i = 0; i < total; i++) {
      if (dc.bufferedAmount > HIGH_WATER) await waitForDrain(dc);
      dc.send(buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    addLog("Sent");
  }

  useEffect(() => leave, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, progress, log, received, join, leave, sendFile };
}