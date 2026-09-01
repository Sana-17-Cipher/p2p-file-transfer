# System Design Study: Peer-to-Peer File Transfer System

## 1. Introduction

This document contains the system design study, technical concepts,
architectural decisions, and implementation plan for a browser-based
Peer-to-Peer (P2P) File Transfer System.

The purpose of this project is not only to build a file-sharing
application, but also to understand how modern systems can allow two
devices to communicate directly over the internet.

The project will be developed gradually. Initially, the focus is on
understanding the concepts and designing the architecture. The
implementation will then be developed and tested step by step.

---

# 2. Inspiration

Applications such as AirDrop provide a simple experience:

    Select a file
          ↓
    Select another device
          ↓
    File is transferred

From a user's perspective, the process looks simple. However, several
technical problems exist behind this experience.

For example:

- How does one device discover another device?
- How can two devices communicate if they are on different networks?
- Can a browser communicate directly with another browser?
- Does the file have to pass through a central server?
- What happens if the devices are behind routers?
- What happens when a direct connection cannot be established?
- How can a large file be transferred without consuming excessive
  memory?
- What happens if the connection is interrupted?
- How can the receiving device know that the file was transferred
  correctly?

These questions form the basis of this project.

The project therefore uses the idea of an AirDrop-like experience as
inspiration, but focuses specifically on understanding and implementing
peer-to-peer communication in a web environment.

---

# 3. Problem Statement

## 3.1 Traditional File Sharing

A common approach to web-based file sharing is a client-server model.

The basic architecture is:

    Sender
       |
       | Upload file
       v
    Server
       |
       | Download file
       v
    Receiver

For example, suppose User A wants to send a 2 GB video to User B.

The process may be:

    User A
       |
       | 2 GB upload
       v
    Application Server
       |
       | 2 GB download
       v
    User B

This introduces several problems.

### Server bandwidth

The server has to receive and send the file.

For one transfer, approximately:

    2 GB upload to server
    +
    2 GB download from server

This increases bandwidth consumption.

### Storage

If the server stores uploaded files, storage is also required.

For a large number of users, storage requirements can grow quickly.

### Latency

The file takes an additional route through the server.

Instead of:

    User A → User B

the data follows:

    User A → Server → User B

### Privacy

The server may temporarily receive the user's file.

Depending on the application's architecture, this creates additional
privacy and security considerations.

---

# 4. Proposed Solution

This project investigates a Peer-to-Peer architecture.

Instead of transferring the file through the application server:

    User A → Server → User B

the desired architecture is:

    User A ←──────────────→ User B
             File Data

The two users attempt to establish a direct connection.

However, an important question immediately appears:

> If the server is not transferring the file, how do the two browsers
> find each other and establish a connection?

This is where signaling is required.

---

# 5. What is Peer-to-Peer (P2P)?

Peer-to-Peer means that participating devices can communicate directly
with one another instead of depending completely on a central server.

The participating devices are called peers.

For this project:

    Browser A = Peer A

    Browser B = Peer B

The desired communication model is:

    Peer A ←────────→ Peer B

The peers can both send and receive information.

This is different from the traditional client-server model:

    Client → Server

where the server is the central point through which communication
takes place.

## Why use P2P?

The main reason for investigating P2P in this project is file transfer.

If two browsers can establish a direct connection, the application
server does not need to become the main carrier of the file data.

This can potentially reduce:

- Server bandwidth usage
- Server-side storage requirements
- Unnecessary data routing

However, P2P does not mean that a server is completely unnecessary.

A server may still be required for connection setup and coordination.

---

# 6. High-Level Architecture

The proposed system has two main parts:

1. Client applications
2. Signaling server

The initial architecture is:

    +-------------------+
    |     Browser A     |
    |       Peer A      |
    +---------+---------+
              |
              | Signaling
              |
              v
    +-------------------+
    |  Signaling Server |
    +-------------------+
              ^
              |
              | Signaling
              |
    +---------+---------+
    |     Browser B     |
    |       Peer B      |
    +-------------------+

After the connection is established:

    +-------------------+       +-------------------+
    |     Browser A     |       |     Browser B     |
    |                   |       |                   |
    |      Peer A       |       |      Peer B       |
    +---------+---------+       +---------+---------+
              \                       /
               \                     /
                \                   /
                 \                 /
                  WebRTC Connection
                         |
                    File Data

The signaling server is used during connection establishment.

The actual file transfer is intended to use the WebRTC connection.

---

# 7. What is a Signaling Server?

WebRTC does not automatically know which other browser it should
connect to.

A signaling mechanism is therefore required.

Signaling is the process of exchanging the information required for
two peers to establish a WebRTC connection.

The signaling server acts as a coordinator.

For example:

    Browser A
       |
       | "I want to connect"
       v
    Signaling Server
       |
       | "Browser B is available"
       v
    Browser B

The server can exchange connection information between the peers.

## Important distinction

The signaling server is not necessarily the file server.

Its purpose is:

    Connection setup
        +
    Peer coordination

rather than:

    Permanent file storage
        +
    File delivery

This distinction is one of the main architectural ideas of this
project.

---

# 8. What is WebRTC?

WebRTC stands for:

    Web Real-Time Communication

It is a set of browser technologies that allows browsers to communicate
with other browsers in real time.

WebRTC can support:

- Audio
- Video
- Data

For this project, the important part is data communication.

We will investigate the WebRTC DataChannel API for transferring file
data.

The simplified architecture is:

    Browser A
        |
        | WebRTC DataChannel
        |
        v
    Browser B

---

# 9. Why WebRTC?

A normal HTTP request generally follows:

    Browser → Web Server

This is useful for retrieving resources from servers.

However, the goal of this project is different.

We want:

    Browser A ←────→ Browser B

WebRTC is designed for real-time peer communication and therefore
provides a suitable foundation for investigating this architecture.

WebRTC also provides mechanisms for dealing with difficult network
conditions, including NAT traversal.

---

# 10. What is RTCDataChannel?

RTCDataChannel is a WebRTC mechanism that allows arbitrary data to be
sent between connected peers.

"Arbitrary data" means it is not limited to HTML pages or API
responses.

It can be used for data such as:

- Text
- Binary data
- File chunks

For this project, the intended flow is:

    File
      |
      v
    File Reader
      |
      v
    File Chunks
      |
      v
    RTCDataChannel
      |
      v
    Receiving Browser
      |
      v
    Reconstructed File

---

# 11. Why Not Send the Entire File at Once?

A file can potentially be very large.

For example:

    video.mp4
    Size = 2 GB

Trying to treat the entire file as one large object can create memory
and reliability problems.

Instead, the file can be divided into smaller pieces.

These pieces are called chunks.

For example:

    2 GB File

       |
       +---- Chunk 1
       +---- Chunk 2
       +---- Chunk 3
       +---- Chunk 4
       |
       ...
       |
       +---- Chunk N

The chunks can then be transferred individually.

---

# 12. File Chunking

Chunking means dividing a large piece of data into smaller units.

For example, a file could conceptually be divided into:

    File
      |
      +---- 1 MB
      +---- 1 MB
      +---- 1 MB
      +---- 1 MB
      +---- ...
      +---- final chunk

The receiving browser collects the chunks and reconstructs the file.

A chunk may be associated with metadata such as:

    transferId
    chunkIndex
    totalChunks
    chunkSize
    data

For example:

    transferId = ABC123

    chunkIndex = 15

    totalChunks = 2048

This allows the receiver to understand where the chunk belongs.

---

# 13. What is a Transfer ID?

A Transfer ID is an identifier assigned to a particular file transfer.

Suppose a user sends three files:

    photo.jpg
    video.mp4
    document.pdf

Each transfer can have a different identifier.

For example:

    Transfer A → T001
    Transfer B → T002
    Transfer C → T003

This helps the receiving side distinguish between different transfers.

---

# 14. What is an ICE Candidate?

One of the difficult parts of P2P networking is that devices often do
not have a simple publicly reachable IP address.

A device may be connected like this:

    Laptop
       |
       v
    Home Router
       |
       v
    Internet

The laptop may have a private IP address.

ICE stands for:

    Interactive Connectivity Establishment

ICE is a framework used by WebRTC to find a suitable network path
between two peers.

It considers different possible connection paths.

These possible paths are represented using ICE candidates.

In simplified terms, the peers exchange possible ways in which they
might be able to reach each other.

---

# 15. What is NAT?

NAT stands for:

    Network Address Translation

NAT is commonly used by routers to allow multiple devices on a private
network to share a public IP address.

For example:

    Laptop       192.168.1.10
    Phone        192.168.1.11
    Tablet       192.168.1.12
         |
         v
      Router
         |
         v
    Public Internet

The devices have private addresses inside the local network.

This creates a problem for peer-to-peer communication.

If Browser A wants to connect directly to Browser B, it may not simply
be able to use Browser B's private IP address.

This is one reason WebRTC needs NAT traversal mechanisms.

---

# 16. What is STUN?

STUN stands for:

    Session Traversal Utilities for NAT

A STUN server helps a device discover information about how it appears
from the public internet.

Simplified example:

    Browser
       |
       | "What is my public network address?"
       v
    STUN Server
       |
       | Public network information
       v
    Browser

The browser can then use this information as one possible connection
path.

STUN does not normally carry the actual file.

It helps with connection discovery.

---

# 17. What is TURN?

TURN stands for:

    Traversal Using Relays around NAT

Sometimes two peers cannot establish a direct connection.

For example:

    Browser A
        X
        X  Direct connection unavailable
        X
    Browser B

In such cases, a TURN server can act as a relay:

    Browser A
        |
        v
    TURN Server
        |
        v
    Browser B

This means the file data can pass through the TURN server.

Therefore, the architecture is not always guaranteed to be:

    Peer A ←────→ Peer B

It may become:

    Peer A → TURN Relay → Peer B

## Why use TURN if the goal is P2P?

TURN is a fallback mechanism.

The system should attempt a direct connection first.

If that fails, a relay may be required for connectivity.

This introduces an important system-design trade-off:

    Direct P2P
        |
        +---- Lower server data transfer
        +---- Better use of peer connection

    TURN Relay
        |
        +---- Better connectivity
        +---- Additional server bandwidth
        +---- Additional infrastructure cost

---

# 18. STUN vs TURN

The two concepts should not be confused.

| Technology | Main Purpose |
|------------|--------------|
| STUN | Helps discover public network information |
| TURN | Relays traffic when direct communication fails |
| ICE | Helps determine a usable connection path |
| WebRTC | Provides the peer communication framework |

A simplified connection process is:

    Start connection
          |
          v
    Exchange signaling information
          |
          v
    Gather ICE candidates
          |
          v
    Try possible connection paths
          |
          v
    Direct connection possible?
       /             \
     Yes              No
      |                |
      v                v
    P2P             TURN Relay

---

# 19. WebSocket

A WebSocket provides a persistent communication channel between a
client and a server.

It is useful for real-time communication such as:

- Chat
- Notifications
- Live updates
- Signaling

For this project, WebSocket can be used by the signaling server.

Example:

    Browser A
       |
       | WebSocket
       v
    Signaling Server
       ^
       | WebSocket
       |
    Browser B

The WebSocket connection can carry signaling messages.

The actual file transfer is intended to occur through WebRTC rather
than through WebSocket.

---

# 20. WebSocket vs WebRTC

These technologies solve different problems.

### WebSocket

    Browser → Server

Used for communication with the signaling server.

### WebRTC

    Browser ←→ Browser

Used for peer-to-peer communication.

Therefore:

    WebSocket
        ↓
    Connection coordination

    WebRTC
        ↓
    Peer communication
        ↓
    File transfer

---

# 21. Complete Connection Establishment Flow

The expected flow is:

## Step 1: User A creates a room

User A opens the application.

The system creates a temporary room.

Example:

    Room ID: ABC123

## Step 2: User B joins

User B enters:

    ABC123

The signaling server now knows that both peers belong to the same
transfer session.

## Step 3: Signaling begins

The peers exchange the information required to establish a WebRTC
connection.

Conceptually:

    Peer A
       |
       | Offer
       v
    Signaling Server
       |
       | Offer
       v
    Peer B

Then:

    Peer B
       |
       | Answer
       v
    Signaling Server
       |
       | Answer
       v
    Peer A

ICE candidates are also exchanged.

## Step 4: WebRTC connection

The peers attempt to establish a suitable network path.

## Step 5: DataChannel

Once the connection is established:

    Peer A ←──── RTCDataChannel ────→ Peer B

## Step 6: File transfer

The sender divides the file into chunks and sends them through the
DataChannel.

---

# 22. Complete File Transfer Flow

The expected process is:

    User selects file
            |
            v
    Read file metadata
            |
            v
    Divide file into chunks
            |
            v
    Send chunk
            |
            v
    Receiver receives chunk
            |
            v
    Store chunk
            |
            v
    Continue until complete
            |
            v
    Reconstruct file
            |
            v
    Verify file integrity
            |
            v
    Allow download

---

# 23. What is Flow Control?

Sending data as quickly as possible is not always a good idea.

Suppose the sender produces data faster than the receiver can process
it.

Conceptually:

    Sender
    ████████████████████
             ↓
          Receiver
          █████

The receiver may become overloaded.

Flow control is the process of controlling the rate at which data is
sent so that the receiving side can keep up.

The implementation will investigate how WebRTC DataChannel buffering
and backpressure can be handled.

---

# 24. What is Backpressure?

Backpressure occurs when a component receiving data cannot process it
as quickly as another component is producing it.

Example:

    Sender speed = 100 MB/s

    Receiver processing capacity = 30 MB/s

If the sender continues at 100 MB/s indefinitely, buffered data may
grow.

A better approach is to monitor the amount of data waiting to be sent
and slow down when necessary.

This will be an important implementation consideration for large files.

---

# 25. Reliability

A network connection is not guaranteed to remain perfect.

Possible problems include:

- Connection interruption
- Network switching
- Browser closing
- Temporary packet problems
- Peer leaving the session

The project will investigate mechanisms to make file transfer more
reliable.

Potential features include:

### Progress tracking

    1.2 GB / 2.0 GB
    60%

### Acknowledgements

The receiver can indicate that a particular portion of the transfer
has been successfully received.

### Retry

If a transfer unit fails, it may be possible to resend it.

### Pause and Resume

The system could remember transfer progress and continue from the
last successfully transferred section.

---

# 26. File Integrity

After transferring a file, the receiving side should ideally verify
that the reconstructed file is identical to the original.

One approach is to use a cryptographic hash.

A hash converts data into a fixed-length value.

Conceptually:

    Original File
          |
          v
        Hash
          |
          v
      ABC123...

The receiver performs the same operation:

    Received File
          |
          v
        Hash
          |
          v
      ABC123...

If the values match, this provides evidence that the data has not
changed during transfer.

The project will investigate suitable hashing mechanisms available in
the browser.

---

# 27. Security Considerations

A file transfer system must consider more than simply transferring
data.

## Unauthorized access

A user should not be able to join another user's transfer session
without authorization.

## Temporary rooms

Room identifiers should ideally be temporary and difficult to guess.

## Signaling security

Signaling communication should use secure transport.

## Malicious files

The receiving user should not automatically execute downloaded files.

## Privacy

The system should minimize unnecessary collection or storage of file
contents and metadata.

## Denial of Service

The signaling service may need rate limiting and connection limits to
prevent abuse.

---

# 28. Privacy Model

One of the design goals is to avoid permanently storing transferred
files on the application server.

The intended model is:

    File
      |
      v
    Sender Browser
      |
      | WebRTC
      v
    Receiver Browser

rather than:

    File
      |
      v
    Central Storage
      |
      v
    Receiver

However, if a TURN relay is required, file data may temporarily pass
through the relay infrastructure.

Therefore, "P2P" does not automatically mean that no server ever sees
network traffic.

This distinction will be considered during the final system design.

---

# 29. Scalability

The first version will focus on one-to-one file transfer.

That means:

    Peer A ←→ Peer B

Later, scalability can be investigated.

For example:

    Peer A
       |
       +---- Peer B
       +---- Peer C
       +---- Peer D

However, multi-peer transfer introduces additional problems.

Questions include:

- How many simultaneous connections can one browser maintain?
- How should files be distributed?
- Should every peer receive the file directly?
- Should peers forward data to other peers?
- How does bandwidth change as the number of peers increases?
- How does the signaling server scale?

The signaling server may also need to handle many simultaneous WebSocket
connections.

TURN infrastructure may become a significant bandwidth and cost
consideration if many connections require relaying.

---

# 30. Performance Metrics

The system should eventually be evaluated using measurable metrics.

Important metrics include:

### Connection establishment time

How long does it take for two peers to become connected?

### Transfer throughput

How quickly is the file transferred?

For example:

    MB/s

### Total transfer time

How long does a complete transfer take?

### Memory usage

How much memory does the browser consume while transferring a large
file?

### CPU usage

How much processing is required?

### Reliability

How often does a transfer fail?

### Recovery time

How quickly can a failed or interrupted transfer recover?

---

# 31. Testing Strategy

Testing should be performed with different file sizes.

For example:

    1 MB
    10 MB
    100 MB
    500 MB
    1 GB
    2 GB

Different network conditions should also be investigated.

Examples:

    Same local network
    Different networks
    Mobile hotspot
    High latency
    Unstable connection

The purpose is to determine how the architecture behaves under
different conditions.

---

# 32. Initial System Requirements

## Functional Requirements

The system should eventually allow a user to:

1. Create a transfer session.
2. Join a transfer session.
3. Establish a connection with another peer.
4. Select a file.
5. Transfer the file.
6. Display transfer progress.
7. Receive the file.
8. Verify the transferred file.
9. Download the reconstructed file.

## Non-Functional Requirements

The system should aim for:

- Low unnecessary server usage
- Reliable transfer
- Reasonable memory usage
- Secure communication
- Simple user experience
- Scalability of the signaling layer
- Privacy-conscious architecture

---

# 33. Proposed Technology Stack

## Frontend

### TypeScript

TypeScript will be used for application logic.

It adds static typing to JavaScript, which can make a larger project
easier to maintain and debug.

### React

React will be used for the user interface.

The interface may contain components such as:

- Create Room
- Join Room
- Connection Status
- File Selection
- Transfer Progress
- Download Status

### HTML and CSS

Used for the structure and visual presentation of the application.

---

## Backend

### Node.js

Node.js will be used for the signaling server.

The server does not need to process the actual file contents in the
intended architecture.

Its main responsibilities are expected to include:

- Managing temporary rooms
- Identifying peers
- Forwarding signaling messages
- Managing connection state

---

## Communication

### WebSocket

Used for real-time communication between browsers and the signaling
server.

### WebRTC

Used to establish peer-to-peer communication between browsers.

### RTCDataChannel

Used for transferring file data between peers.

---

## Network Traversal

### STUN

Used to help discover public network information.

### TURN

Used as a relay when direct peer-to-peer communication is not possible.

---

# 34. Why This Technology Stack?

The stack is intentionally based on technologies that work naturally
within modern browsers.

The overall architecture is:

    React
      |
      v
    TypeScript
      |
      +-------------------+
      |                   |
      v                   v
    WebSocket           WebRTC
      |                   |
      v                   v
    Signaling          DataChannel
    Server                 |
                           v
                       File Transfer

This allows the project to remain primarily browser-based while still
providing a backend component for signaling.

---

# 35. Questions I Need to Answer During Development

The following questions will guide the implementation and research.

## Networking

1. How do two browsers discover each other?
2. Why is signaling necessary?
3. Why can't WebRTC establish the connection without signaling?
4. What exactly does ICE do?
5. What is NAT?
6. Why does NAT make P2P difficult?
7. What is the difference between STUN and TURN?
8. When is TURN required?

## File Transfer

9. How should a large file be divided?
10. What chunk size should be used?
11. How does the receiver reconstruct the file?
12. How should missing chunks be detected?
13. How should interrupted transfers resume?
14. How should backpressure be handled?
15. How can file integrity be verified?

## System Design

16. What responsibilities belong on the client?
17. What responsibilities belong on the server?
18. What happens when the signaling server goes down?
19. What happens when a peer disconnects?
20. How many concurrent rooms can the signaling server support?
21. What happens when many users require TURN relays?

## Security

22. How should users authenticate?
23. How should temporary rooms be protected?
24. Can someone guess a room ID?
25. What file metadata is exposed?
26. How should malicious files be handled?

## Performance

27. What is the maximum practical file size?
28. How much memory does the browser use?
29. How does network latency affect transfer speed?
30. How does direct P2P performance compare with a server-based
    transfer?

These questions will be answered progressively through research,
implementation, testing, and measurement.

---

# 36. Development Roadmap

The project will be implemented incrementally.

## Phase 1 — Concept and Architecture

- Study P2P networking
- Study WebRTC
- Study signaling
- Study WebSocket
- Study NAT
- Study STUN and TURN
- Document architecture

Status:

    Planned

## Phase 2 — Basic Signaling

Build a basic Node.js signaling server.

Goal:

    Browser A
        |
        v
    Signaling Server
        ^
        |
    Browser B

At this stage, the system only needs to exchange messages required for
connection establishment.

## Phase 3 — WebRTC Connection

Establish a WebRTC connection between two browser instances.

Initial goal:

    Peer A ←──── WebRTC ────→ Peer B

No file transfer yet.

## Phase 4 — DataChannel

Send a simple text message.

Example:

    Peer A:
    "Hello from Peer A"

    ↓

    Peer B:
    "Hello from Peer A"

This verifies that the DataChannel is working.

## Phase 5 — Small File Transfer

Transfer a small file.

Example:

    test.txt
    10 KB

Verify that the received file can be opened correctly.

## Phase 6 — Chunked Transfer

Introduce file chunking.

Test progressively larger files:

    1 MB
    10 MB
    100 MB
    500 MB
    1 GB

## Phase 7 — Reliability

Investigate:

- Progress tracking
- Backpressure
- Acknowledgements
- Retry
- Pause
- Resume
- Connection failure handling

## Phase 8 — Integrity

Add file integrity verification using hashing.

## Phase 9 — Network Testing

Test:

- Same network
- Different networks
- NAT environments
- Network switching
- Unstable connections

## Phase 10 — Performance Evaluation

Measure:

- Connection time
- Transfer speed
- Transfer duration
- Memory usage
- CPU usage
- Failure rate

## Phase 11 — Final System

Integrate the completed components into a usable browser-based file
transfer application.

---

# 37. Expected Final Architecture

The expected final architecture is:

                         +----------------------+
                         |  Signaling Server    |
                         |                      |
                         |  Room Management     |
                         |  Peer Coordination   |
                         +----------+-----------+
                                    ^
                                    |
                             WebSocket
                           Signaling Data
                                    |
                   +----------------+----------------+
                   |                                 |
                   v                                 v

          +------------------+              +------------------+
          |    Browser A     |              |    Browser B     |
          |                  |              |                  |
          |     Peer A       |              |     Peer B       |
          |                  |              |                  |
          | File Reader      |              | File Receiver    |
          | Chunking         |              | Reconstruction   |
          +--------+---------+              +---------+--------+
                   \                                  /
                    \                                /
                     \                              /
                      +----------------------------+
                              WebRTC
                          RTCDataChannel
                              File Data

Possible fallback:

          Browser A
              |
              v
          TURN Relay
              |
              v
          Browser B

The actual architecture will be updated if implementation or testing
reveals better approaches.

---

# 38. Design Trade-offs

A major purpose of this project is to understand that system design
usually involves trade-offs rather than a single perfect solution.

## P2P vs Client-Server

### P2P

Advantages:

- Less dependence on central file storage
- Potentially lower server bandwidth requirements
- Direct communication

Disadvantages:

- More complex connection establishment
- NAT traversal problems
- Connection reliability becomes more difficult
- TURN may still be required

### Client-Server

Advantages:

- Easier architecture
- Easier monitoring
- Easier centralized storage
- Easier access control

Disadvantages:

- Higher server bandwidth usage
- Storage requirements
- Server becomes a central dependency

The project will investigate whether the additional complexity of P2P
is justified for browser-based file transfer.

---

# 39. Current Understanding

At the beginning of this project, the main concepts being studied are:

    P2P
      ↓
    WebRTC
      ↓
    Signaling
      ↓
    WebSocket
      ↓
    ICE
      ↓
    STUN / TURN
      ↓
    RTCDataChannel
      ↓
    Chunking
      ↓
    Reliability
      ↓
    Integrity
      ↓
    Performance

The implementation will be used to convert these theoretical concepts
into practical understanding.

---

