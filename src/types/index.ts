export type Role = 'ADMIN' | 'MEMBER';

export type RoomType = 'DIRECT' | 'ROOM';

export type UserStatus = 'ONLINE' | 'IDLE' | 'OFFLINE' | 'HIDDEN';

export type Visibility = 'EVERYONE' | 'CONTACTS' | 'NOBODY';

export interface User {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  birthday?: string | null;
  status?: UserStatus;
  pushToken?: string | null;
  publicKey?: string | null;
  lastSeenAt?: string | null;
  createdAt?: string;
}

export interface UserSettings {
  userId: string;
  lastSeenVisibility: Visibility;
  avatarVisibility: Visibility;
  bioVisibility: Visibility;
  roomInviteVisibility: Visibility;
  callVisibility: Visibility;
  readReceipts: boolean;
  notifyPrivate: boolean;
  notifyRooms: boolean;
  notifyCalls: boolean;
  messagePreview: boolean;
  inAppSounds: boolean;
  inAppVibrate: boolean;
  messageTextSize: number;
  chatWallpaper: string;
  sendByEnter: boolean;
  timeFormat24h: boolean;
}

export interface Contact {
  id: string;
  nickname?: string | null;
  createdAt: string;
  user: User;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: Role;
  joinedAt: string;
  user: User;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'STICKER' | 'SYSTEM' | 'CALL';

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface MessageReply {
  id: string;
  content: string;
  ciphertext?: string | null;
  nonce?: string | null;
  senderPublicKey?: string | null;
  type: MessageType;
  deletedAt?: string | null;
  sender: {
    id: string;
    displayName: string;
    username: string;
    publicKey?: string | null;
  };
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  ciphertext?: string | null;
  nonce?: string | null;
  senderPublicKey?: string | null;
  type?: MessageType;
  replyToId?: string | null;
  replyTo?: MessageReply | null;
  reactions?: MessageReaction[];
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  sender: User;
  isPending?: boolean;
  localUri?: string | null;
}

export interface Room {
  id: string;
  type: RoomType;
  name?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  membersCount?: number;
  onlineCount?: number;
  members?: RoomMember[];
  lastMessage?: Message | null;
  peer?: User | null; // DM'lerde karşı kullanıcı
  unreadCount?: number;
  isPinned?: boolean;
  isArchived?: boolean;
  mutedUntil?: string | null;
  isMuted?: boolean;
  myRole?: Role;
  lastReadAt?: string | null;
  othersReadAt?: string | null;
  createdBy?: User;
}

export interface VoiceParticipant {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
}

export interface IncomingCall {
  callId: string;
  roomId: string;
  video: boolean;
  state: 'ringing' | 'active';
  caller: User;
  callee: User;
  startedAt: number;
  acceptedAt?: number | null;
  mediaRoom: string;
}

