export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface CurrentTrack {
  trackId: string;
  title: string;
  artist: string;
  albumArt: string;
  startedAt: number;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface Broadcast {
  id: string;
  userId?: string;
  anonymousId: string;
  trackTitle: string;
  artistName: string;
  albumArtUrl: string;
  startedAt: number;
  location: GeoPosition;
  createdAt: number;
}

export interface Comment {
  id: string;
  broadcastId: string;
  authorAnonId: string;
  text: string;
  createdAt: number;
}

export interface DM {
  id: string;
  senderAnonId: string;
  recipientAnonId: string;
  text: string;
  createdAt: number;
  includesConnectionRequest: boolean;
}

export interface ConnectionRequest {
  id: string;
  viewerUserId: string;
  broadcasterUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  createdAt: number;
  expiresAt: number;
}

export interface Connection {
  id: string;
  userAId: string;
  userBId: string;
  spotifyProfileA: SpotifyProfile;
  spotifyProfileB: SpotifyProfile;
  createdAt: number;
}

export interface SpotifyProfile {
  displayName: string;
  profileImageUrl: string;
  profileLink: string;
  topArtists: string[];
  topTracks: string[];
}

export type ReactionType = 'fire' | 'heart' | 'headphones' | 'clap' | 'surprised';

export interface ReactionCount {
  [key: string]: number;
}
