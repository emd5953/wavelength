/**
 * Presence heartbeat — tells the server the app is open.
 *
 * The server ends a listening session once the user has stopped playing AND
 * been away from the app for 5 minutes, so this pings every 60s while the app
 * is in the foreground and stops in the background. Each ping returns the
 * caller's current anonymous id, cached here for "is this me" checks.
 */

import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { sendPresence } from './api';

const HEARTBEAT_INTERVAL = 60_000;

let myAnonId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;

async function ping(): Promise<string | null> {
  try {
    const { anonymousId } = await sendPresence();
    myAnonId = anonymousId;
  } catch {
    // Offline or signed out — the next ping retries
  }
  return myAnonId;
}

function startTimer(): void {
  if (timer) return;
  ping();
  timer = setInterval(ping, HEARTBEAT_INTERVAL);
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onAppStateChange(state: AppStateStatus): void {
  if (state === 'active') startTimer();
  else stopTimer();
}

export function startPresence(): void {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', onAppStateChange);
  if (AppState.currentState === 'active') startTimer();
}

export function stopPresence(): void {
  stopTimer();
  appStateSub?.remove();
  appStateSub = null;
}

/** The caller's current anonymous id, pinging the server if none is cached yet. */
export async function getMyAnonId(): Promise<string | null> {
  return myAnonId ?? ping();
}
