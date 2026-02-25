/**
 * WebSocket layer for real-time feed updates.
 * Emits broadcast:new and broadcast:removed to nearby clients.
 * Listens for location:update to re-subscribe clients to geo channels.
 * Requirement: 4.2
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { getBroadcastsInRadius } from './broadcastService';
import { validateRadius } from './proximityService';
import type { Broadcast, GeoPosition } from '../types';

interface ClientState {
  userId: string;
  location: GeoPosition;
  radius: number;
}

const clientStates = new Map<string, ClientState>();

export function initFeedSocket(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    socket.on('location:update', async (data: { userId: string; location: GeoPosition; radius?: number }) => {
      const radius = validateRadius(data.radius ?? 100);
      clientStates.set(socket.id, {
        userId: data.userId,
        location: data.location,
        radius,
      });
    });

    socket.on('disconnect', () => {
      clientStates.delete(socket.id);
    });
  });
}

/**
 * Notify all connected clients about a new broadcast.
 * Only emits to clients whose last known location is within range.
 */
export async function emitBroadcastNew(io: SocketIOServer, broadcast: Broadcast): Promise<void> {
  for (const [socketId, state] of clientStates) {
    if (isWithinRadius(state.location, broadcast.location, state.radius)) {
      // Don't send a user their own broadcast
      if (state.userId === (broadcast as any).userId) continue;
      io.to(socketId).emit('broadcast:new', broadcast);
    }
  }
}

/**
 * Notify all connected clients that a broadcast was removed.
 */
export function emitBroadcastRemoved(io: SocketIOServer, broadcastId: string, broadcastLocation: GeoPosition): void {
  for (const [socketId, state] of clientStates) {
    if (isWithinRadius(state.location, broadcastLocation, state.radius)) {
      io.to(socketId).emit('broadcast:removed', broadcastId);
    }
  }
}

/** Haversine distance check */
function isWithinRadius(a: GeoPosition, b: GeoPosition, radiusMeters: number): boolean {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  const dist = 2 * R * Math.asin(Math.sqrt(h));
  return dist <= radiusMeters;
}
