import { useState } from "react";
import { usePeerTransfer } from "./usePeerTransfer";

export default function App() {
  const [room, setRoom] = useState("lobby");
  const { status, progress, log, received, join, leave, sendFile } = usePeerTransfer();

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>P2P File Transfer</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room name" />
        <button onClick={() => join(room)} disabled={status !== "idle" && status !== "failed"}>
          Join
        </button>
        <button onClick={leave} disabled={status === "idle"}>Leave</button>
      </div>

      <p>Status: <strong>{status}</strong></p>

      <input
        type="file"
        disabled={status !== "connected"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void sendFile(f);
          e.target.value = "";
        }}
      />

      <progress value={progress} max={100} style={{ width: "100%", marginTop: 12 }} />

      {received && (
        <p>
          <a href={received.url} download={received.name}>Download {received.name}</a>{" "}
          {received.verified ? "✅ integrity verified" : "❌ hash mismatch"}
        </p>
      )}

      <pre style={{ background: "#111", color: "#9f9", padding: 12, minHeight: 120, overflow: "auto" }}>
        {log.join("\n")}
      </pre>
    </main>
  );
}