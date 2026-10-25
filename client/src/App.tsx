import { useEffect, useState } from "react";
import { usePeerTransfer } from "./usePeerTransfer";

function makeRoomCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const c = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${c.slice(0, 4).join("")}-${c.slice(4, 8).join("")}-${c.slice(8).join("")}`;
}

function inviteLink(room: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", room);
  return url.toString();
}

export default function App() {
  const { status, progress, log, received, join, leave, sendFile } = usePeerTransfer();
  const [room, setRoom] = useState<string | null>(() =>
  new URLSearchParams(window.location.search).get("room")
);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);

  function enter(code: string) {
    setRoom(code);
    window.history.replaceState(null, "", inviteLink(code));
    join(code);
  }

  function exit() {
    leave();
    setRoom(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function copyLink() {
    if (!room) return;
    await navigator.clipboard.writeText(inviteLink(room));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Opening an invite link joins its room automatically
  useEffect(() => {
    
    if (room) join(room);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1>P2P File Transfer</h1>

      {!room ? (
        <>
          <button onClick={() => enter(makeRoomCode())}>Create a room</button>
          <p>or join with a code:</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.trim())}
              placeholder="abcd-efgh-jkmn"
            />
            <button onClick={() => codeInput && enter(codeInput)} disabled={!codeInput}>
              Join
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Room: <strong>{room}</strong>
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input readOnly value={inviteLink(room)} style={{ flex: 1 }} onFocus={(e) => e.target.select()} />
            <button onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
            <button onClick={exit}>Leave</button>
          </div>
          <p>
            Status: <strong>{status}</strong>
          </p>

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
              <a href={received.url} download={received.name}>
                Download {received.name}
              </a>{" "}
              {received.verified ? "✅ integrity verified" : "❌ hash mismatch"}
            </p>
          )}
        </>
      )}

      <pre style={{ background: "#111", color: "#9f9", padding: 12, minHeight: 120, overflow: "auto" }}>
        {log.join("\n")}
      </pre>
    </main>
  );
}