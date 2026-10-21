/**
 * WebSocket layer for real-time feed updates.
 * Emits broadcast:new to nearby clients and broadcast:ended to all clients.
 * Listens for location:update to re-subscribe clients to geo channels.
 * Requirement: 4.2
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
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

    // Plays outlive the socket (they stay in the feed for 6h), so a
    // disconnect only forgets the client's subscription.
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
  // The real user id never leaves the server
  const { userId, ...publicPlay } = broadcast;
  const payload = { ...publicPlay, timeSinceStart: Date.now() - broadcast.startedAt };

  for (const [socketId, state] of clientStates) {
    if (isWithinRadius(state.location, broadcast.location, state.radius)) {
      // Don't send a user their own broadcast
      if (state.userId === userId) continue;
      io.to(socketId).emit('broadcast:new', payload);
    }
  }
}

/**
 * Notify clients that plays stopped being live. They stay in the feed as
 * recently played; the id alone reveals nothing to clients that never saw it.
 */
export function emitPlaysEnded(io: SocketIOServer, playIds: string[]): void {
  for (const id of playIds) io.emit('broadcast:ended', id);
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
