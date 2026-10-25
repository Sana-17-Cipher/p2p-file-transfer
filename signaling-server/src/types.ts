export type ClientMessage =
  | { type: "join-room"; roomId: string }
  | { type: "offer"; sdp: unknown }
  | { type: "answer"; sdp: unknown }
  | { type: "ice-candidate"; candidate: unknown };

export type ServerMessage =
  | { type: "joined"; peerId: string; peers: string[] }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | { type: "offer"; from: string; sdp: unknown }
  | { type: "answer"; from: string; sdp: unknown }
  | { type: "ice-candidate"; from: string; candidate: unknown };

export const CloseCode = {
  RoomFull: 4001,
  BadMessage: 4002,
  OriginNotAllowed: 4003,
} as const;