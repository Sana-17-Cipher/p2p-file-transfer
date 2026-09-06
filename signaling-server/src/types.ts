export type ClientMessage =
  | { type: 'join-room'; roomId: string };

export type ServerMessage =
  | { type: 'joined-room'; roomId: string; peerId: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'room-full' };