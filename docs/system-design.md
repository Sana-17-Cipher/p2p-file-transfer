# System Design

## 1. Problem Statement

Traditional web-based file sharing usually requires a file to be
uploaded to a server before another user can download it.

This project explores a peer-to-peer approach where two browsers
establish a direct connection and transfer files without requiring
permanent server-side file storage.

## 2. Client-Server vs P2P

### Traditional

User A → Server → User B

The server receives and stores/transfers the file.

### Proposed

User A ←──── P2P Connection ────→ User B

The server is primarily responsible for signaling.

## 3. Signaling

Before two browsers can communicate through WebRTC, they need to
exchange connection information.

A WebSocket-based signaling server will coordinate this process.

The signaling server does not need to receive the actual file.

## 4. WebRTC

WebRTC will be used to establish communication between the browsers.

The RTCDataChannel API can be used to send arbitrary data between peers,
including file chunks.

## 5. Large File Transfer

Large files should not be loaded entirely into memory.

The file can be divided into smaller chunks:

File
↓
Chunk 1
Chunk 2
Chunk 3
...
Chunk N

The receiving browser reconstructs the original file from these chunks.

## 6. Reliability

Future versions may implement:

- Chunk acknowledgements
- Retry mechanisms
- Pause and resume
- Transfer progress
- File integrity verification

## 7. NAT Traversal

Not every device can establish a direct connection immediately.

The system will investigate:

- STUN servers for discovering public network information
- TURN servers as a relay fallback when direct P2P communication fails

## 8. Security Considerations

The system should consider:

- Secure signaling
- Connection authorization
- Temporary rooms
- File metadata exposure
- Malicious file handling
- Rate limiting

## 9. Future Work

The initial implementation will focus on establishing a connection
between two browsers.

File transfer and reliability features will then be added incrementally.