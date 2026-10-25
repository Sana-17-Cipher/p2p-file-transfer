import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { startServer } from "./server.js";

const ORIGIN = "http://localhost:5173";
let server: Awaited<ReturnType<typeof startServer>>;

beforeEach(async () => {
  server = await startServer({ port: 0, allowedOrigins: [ORIGIN] });
});
afterEach(async () => {
  await server.close();
});

interface TestClient {
  ws: WebSocket;
  inbox: any[];
}

function connect(origin = ORIGIN): TestClient {
  const ws = new WebSocket(`ws://localhost:${server.port}`, { origin });
  const inbox: any[] = [];
  ws.on("message", (d) => inbox.push(JSON.parse(d.toString())));
  return { ws, inbox };
}

const opened = (c: TestClient) =>
  new Promise<void>((resolve) => c.ws.once("open", () => resolve()));

const closed = (c: TestClient) =>
  new Promise<number>((resolve) => c.ws.once("close", (code) => resolve(code)));

async function waitFor(c: TestClient, type: string): Promise<any> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const i = c.inbox.findIndex((m) => m.type === type);
    if (i >= 0) return c.inbox.splice(i, 1)[0];
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`timed out waiting for "${type}"`);
}

async function join(c: TestClient, roomId: string) {
  await opened(c);
  c.ws.send(JSON.stringify({ type: "join-room", roomId }));
  return waitFor(c, "joined");
}

describe("signaling server", () => {
  it("lets a peer join an empty room", async () => {
    const a = connect();
    const joined = await join(a, "r1");
    expect(joined.peers).toEqual([]);
    expect(typeof joined.peerId).toBe("string");
  });

  it("tells both peers about each other", async () => {
    const a = connect();
    const aJoined = await join(a, "r1");
    const b = connect();
    const bJoined = await join(b, "r1");

    expect(bJoined.peers).toEqual([aJoined.peerId]);
    const notice = await waitFor(a, "peer-joined");
    expect(notice.peerId).toBe(bJoined.peerId);
  });

  it("relays offer, answer and ICE candidates with the sender's id", async () => {
    const a = connect();
    const aJoined = await join(a, "r1");
    const b = connect();
    const bJoined = await join(b, "r1");

    a.ws.send(JSON.stringify({ type: "offer", sdp: { type: "offer", sdp: "x" } }));
    const offer = await waitFor(b, "offer");
    expect(offer.from).toBe(aJoined.peerId);
    expect(offer.sdp).toEqual({ type: "offer", sdp: "x" });

    b.ws.send(JSON.stringify({ type: "answer", sdp: { type: "answer", sdp: "y" } }));
    const answer = await waitFor(a, "answer");
    expect(answer.from).toBe(bJoined.peerId);

    a.ws.send(JSON.stringify({ type: "ice-candidate", candidate: { candidate: "c1" } }));
    const ice = await waitFor(b, "ice-candidate");
    expect(ice.candidate).toEqual({ candidate: "c1" });
  });

  it("does not echo a message back to its sender", async () => {
    const a = connect();
    await join(a, "r1");
    const b = connect();
    await join(b, "r1");

    a.ws.send(JSON.stringify({ type: "offer", sdp: {} }));
    await waitFor(b, "offer");
    await new Promise((r) => setTimeout(r, 100));
    expect(a.inbox.find((m) => m.type === "offer")).toBeUndefined();
  });

  it("keeps rooms isolated", async () => {
    const a = connect();
    await join(a, "r1");
    const outsider = connect();
    await join(outsider, "r2");

    a.ws.send(JSON.stringify({ type: "offer", sdp: {} }));
    await new Promise((r) => setTimeout(r, 100));
    expect(outsider.inbox.find((m) => m.type === "offer")).toBeUndefined();
  });

  it("rejects a third peer with close code 4001", async () => {
    await join(connect(), "r1");
    await join(connect(), "r1");

    const c = connect();
    const code = closed(c);
    await opened(c);
    c.ws.send(JSON.stringify({ type: "join-room", roomId: "r1" }));
    expect(await code).toBe(4001);
  });

  it("rejects a disallowed origin with close code 4003", async () => {
    const c = connect("http://evil.example");
    expect(await closed(c)).toBe(4003);
  });

  it("rejects invalid JSON with close code 4002", async () => {
    const c = connect();
    const code = closed(c);
    await opened(c);
    c.ws.send("this is not json");
    expect(await code).toBe(4002);
  });

  it("notifies the remaining peer when the other leaves", async () => {
    const a = connect();
    await join(a, "r1");
    const b = connect();
    const bJoined = await join(b, "r1");

    b.ws.close();
    const left = await waitFor(a, "peer-left");
    expect(left.peerId).toBe(bJoined.peerId);
  });
});