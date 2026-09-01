# Peer-to-Peer File Transfer System

A system design and implementation study of browser-based peer-to-peer
file transfer using WebRTC.

## Overview

This project explores the design of a browser-based file transfer system
in which files are transferred directly between two peers rather than
being uploaded to and downloaded from a central application server.

The primary purpose of this repository is to study the underlying system
design concepts involved in peer-to-peer communication, including
signaling, NAT traversal, data channels, large-file transfer, reliability,
security, and connection management.

The project will initially focus on understanding and documenting the
architecture before progressing toward a working implementation.

## Problem Statement

Conventional web-based file sharing generally follows a client-server
model:

    Sender → Application Server → Receiver

This approach requires the application server to receive, process, and
potentially store the transferred file.

The proposed system investigates an alternative architecture:

    Sender ←──── Peer-to-Peer Connection ────→ Receiver

A lightweight signaling service is used to help establish the connection,
while the actual file transfer is intended to occur between the peers.

## Objectives

The project aims to:

1. Understand the architecture of browser-based peer-to-peer systems.
2. Study how WebRTC establishes communication between browsers.
3. Understand the role of signaling servers in peer discovery and
   connection establishment.
4. Investigate NAT traversal using STUN and TURN.
5. Design an efficient mechanism for transferring large files.
6. Study reliability mechanisms such as chunking, acknowledgements,
   retries, and resumable transfers.
7. Evaluate the security and privacy considerations of peer-to-peer
   file transfer.
8. Implement and evaluate the proposed architecture incrementally.

## Proposed Architecture

The system consists of two primary components:

### 1. Client Applications

The browser clients are responsible for:

- Creating or joining a transfer session.
- Establishing a WebRTC connection.
- Reading files locally.
- Dividing files into transferable chunks.
- Sending and receiving file data.
- Reconstructing the received file.
- Displaying transfer progress and connection status.

### 2. Signaling Server

The signaling server is responsible for coordinating the initial
connection between peers.

It may exchange:

- Session descriptions (SDP)
- ICE candidates
- Room or peer information

The signaling server is not intended to act as permanent file storage
or as the primary transport mechanism for file data.

High-level architecture:

    Client A
       |
       | Signaling
       |
       v
    Signaling Server
       ^
       |
       | Signaling
       |
    Client B

After connection establishment:

    Client A
       |
       | WebRTC DataChannel
       |
       v
    Client B

## Core System Design Concepts

The project will investigate the following concepts:

- Peer-to-peer networking
- Client-server architecture
- WebRTC
- WebSocket-based signaling
- RTCDataChannel
- ICE
- STUN
- TURN
- NAT traversal
- File chunking
- Flow control
- Data integrity
- Connection failure handling
- Scalability
- Security and privacy

## Proposed Technology Stack

### Client

- TypeScript
- React
- HTML
- CSS

### Communication

- WebRTC
- WebSocket

### Server

- Node.js

### Network Traversal

- STUN
- TURN

The technology choices may be revised as the system is implemented and
evaluated.

## Development Approach

The system will be developed incrementally rather than implementing the
entire architecture at once.

### Phase 1: Architecture and Research

- Study peer-to-peer networking.
- Study WebRTC architecture.
- Understand signaling.
- Study STUN, TURN, and NAT traversal.
- Document the proposed architecture.

### Phase 2: Connection Establishment

- Implement a signaling server.
- Create temporary transfer sessions.
- Establish a WebRTC connection between two browsers.
- Verify peer connectivity.

### Phase 3: Data Transfer

- Transfer text through RTCDataChannel.
- Transfer small files.
- Introduce file chunking.
- Reconstruct files on the receiving side.

### Phase 4: Reliability

- Transfer progress tracking.
- Flow control.
- Chunk acknowledgements.
- Retry mechanisms.
- Pause and resume support.
- File integrity verification.

### Phase 5: Evaluation

The completed system will be evaluated using metrics such as:

- Connection establishment time
- Transfer throughput
- Transfer latency
- Memory usage
- File size
- Failure and recovery behaviour
- Performance under different network conditions

## Security and Privacy Considerations

The project will investigate:

- Secure signaling
- Authentication and authorization
- Temporary transfer sessions
- Unauthorized peer access
- Malicious file handling
- Metadata exposure
- Denial-of-service and abuse prevention

A key design objective is to avoid unnecessary permanent storage of
transferred files on the application server.

## Current Status

The repository currently represents the design and research phase of
the project.

The architecture, assumptions, and technology choices will be refined
as the concepts are studied and the implementation is developed.

No implementation feature is considered complete until it has been
implemented and tested.

## Future Scope

Potential future improvements include:

- Multi-peer file sharing
- Improved connection discovery
- Transfer history
- Authentication
- Password-protected transfer sessions
- Network-aware transfer optimization
- Advanced failure recovery
- Performance comparison between different transfer strategies

