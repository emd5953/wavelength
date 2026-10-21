/**
 * WebSocket client for real-time feed updates.
 * Listens for broadcast:new and broadcast:ended events.
 * Sends location:update to re-subscribe to nearby broadcasts.
 * Requirement: 4.2
 */

import { io, Socket } from 'socket.io-client';
import type { FeedBroadcast, ConnectionRequestData, ConnectionData } from './api';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export type FeedEventCallback = {
  onBroadcastNew?: (broadcast: FeedBroadcast) => void;
  /** A play stopped being live; it stays in the feed as recently played. */
  onBroadcastEnded?: (broadcastId: string) => void;
  onConnectionRequest?: (request: ConnectionRequestData) => void;
  onConnectionAccepted?: (connection: ConnectionData) => void;
  onConnectionDeclined?: (requestId: string) => void;
};

export function connectFeedSocket(callbacks: FeedEventCallback): Socket {
  if (socket?.connected) return socket;

  socket = io(API_BASE, { transports: ['websocket'] });

  socket.on('broadcast:new', (broadcast: FeedBroadcast) => {
    callbacks.onBroadcastNew?.(broadcast);
  });

  socket.on('broadcast:ended', (broadcastId: string) => {
    callbacks.onBroadcastEnded?.(broadcastId);
  });

  socket.on('connection:request', (request: ConnectionRequestData) => {
    callbacks.onConnectionRequest?.(request);
  });

  socket.on('connection:accepted', (connection: ConnectionData) => {
    callbacks.onConnectionAccepted?.(connection);
  });

  socket.on('connection:declined', (requestId: string) => {
    callbacks.onConnectionDeclined?.(requestId);
  });

  return socket;
}

export function sendLocationUpdate(userId: string, latitude: number, longitude: number, radius?: number): void {
  socket?.emit('location:update', {
    userId,
    location: { latitude, longitude, accuracy: 0, timestamp: Date.now() },
    radius,
  });
}

export function disconnectFeedSocket(): void {
  socket?.disconnect();
  socket = null;
}
