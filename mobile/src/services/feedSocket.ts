/**
 * WebSocket client for real-time feed updates.
 * Listens for broadcast:new and broadcast:removed events.
 * Sends location:update to re-subscribe to nearby broadcasts.
 * Requirement: 4.2
 */

import { io, Socket } from 'socket.io-client';
import type { FeedBroadcast } from './api';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export type FeedEventCallback = {
  onBroadcastNew?: (broadcast: FeedBroadcast) => void;
  onBroadcastRemoved?: (broadcastId: string) => void;
};

export function connectFeedSocket(callbacks: FeedEventCallback): Socket {
  if (socket?.connected) return socket;

  socket = io(API_BASE, { transports: ['websocket'] });

  socket.on('broadcast:new', (broadcast: FeedBroadcast) => {
    callbacks.onBroadcastNew?.(broadcast);
  });

  socket.on('broadcast:removed', (broadcastId: string) => {
    callbacks.onBroadcastRemoved?.(broadcastId);
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
