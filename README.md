# P2P File Transfer

Send a file from one browser to another browser **directly**. The file is not uploaded to any server, and no account is needed.

I made this as a learning project to understand how WebRTC, WebSockets and real-time apps work.

**Live demo:** https://p2p-file-transfer-1-9duw.onrender.com
*(The server is on a free plan and goes to sleep when nobody uses it. The first connection can take up to a minute. Please wait and it will connect.)*

---

## 1. What is this project?

Normally, when you send a file on the internet, it goes like this:

> You → upload to a server → the other person downloads from the server

In this project it goes like this:

> You → directly to the other person

The only thing my server does is **introduce the two browsers to each other**. After they are introduced, the file travels straight between them. My server never sees the file.

## 2. How to use it

1. Open the website and click **Create a room**.
2. Click **Copy link** and send the link to your friend (WhatsApp, anything).
3. Your friend opens the link. When both of you see **connected**, one person picks a file. The other person gets a download link.

After the file is received, the page says **"integrity verified"** if the file arrived without any damage.

---


### The steps

1. Person A opens the link and joins a room. The server says "wait for someone".
2. Person B opens the same link and joins. The server tells A "someone joined".
3. A creates an **offer** (a description of what A can do) and sends it to B through the server.
4. B creates an **answer** and sends it back through the server.
5. Both browsers send **ICE candidates** (possible addresses where they can be reached). The server passes these along too.
6. The browsers find a working path. A **data channel** opens between them.
7. Now the server is not needed. The file goes through the data channel.

### How the file is sent

- The file is cut into small pieces of **16 KB** each.
- Every piece gets a **number** (so the receiver knows the order) and a **SHA-256 fingerprint** (so the receiver can check the piece is not damaged).
- If the sender is sending faster than the network can handle, it **pauses** and waits (this is called backpressure). It pauses when more than 1 MB is waiting, and continues when it drops below 256 KB.
- The receiver checks every piece, puts it in the right place, and joins all pieces into the file at the end.

---

## 3. Technologies used

| Part | What I used |
|---|---|
| Signaling server | Node.js, TypeScript, `ws` (raw WebSockets, no Socket.io) |
| Website | React, TypeScript, Vite |
| Direct connection | WebRTC (RTCPeerConnection and RTCDataChannel) |
| File check | SHA-256 using the browser's `crypto.subtle` |
| Tests | Vitest, with real WebSocket connections |
| Testing across networks | Cloudflare Tunnel (temporary public links) |
| TURN relay | Metered (free plan) |
| Hosting | Render (free web service + free static site) |

---


## 4. Run it on your computer

You need Node.js installed.

```bash
git clone https://github.com/Sana-17-Cipher/p2p-file-transfer.git
cd p2p-file-transfer
```

**Start the server**
```bash
cd signaling-server
npm install
npm run dev
```

**Start the website** (in a second terminal)
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in two tabs, create a room in one, and open the invite link in the other.

**Run the tests**
```bash
cd signaling-server
npm test
```


## 5. Limitations

- **Two people per room.** It is one-to-one only.
- **Both people must be online at the same time.** There is no storage. If someone closes the tab, the transfer stops.
- **No resume.** If the connection drops in the middle of a transfer, it starts again from the beginning.
- **Big files use a lot of memory.** The sender reads one piece at a time, but the receiver keeps the whole file in memory until it finishes. Very large files can crash a phone browser.
- **Free server sleeps.** After 15 minutes without use, it sleeps, and the first connection can take up to a minute.
- **Not every network works.** Some school or office networks block even TURN.
- **No login.** Anyone with the room link can join (as long as the room has space).

---

## 6. Improvements I can make

- Short-lived TURN passwords that the server gives out, instead of one fixed password in the website
- Resume a transfer from where it stopped (the piece numbers already make this possible)
- Save big files straight to disk while receiving, so memory doesn't fill up
- Send many files at once, or a whole folder
- More than 2 people in a room
- QR code for the invite link, to connect phone and laptop faster
- A password for the room
- Show transfer speed and time left
- Drag and drop files
- Paid or always-on hosting so the server never sleeps
- More tests, including tests for the website

---

## 7. Where can this be used?

- Sending files between your own laptop and phone without cables or cloud uploads
- Sending private files to a friend without storing them on any company's server
- Sharing big files in a class or college lab
- Learning WebRTC. The same ideas are used in **video calls, voice chat, online games and screen sharing**
- A base for building chat apps, whiteboards or other real-time tools

---
