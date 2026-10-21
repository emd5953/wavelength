import { endStalePlays, expireOldPlays } from './services/broadcastService';
import { expireStaleRequests } from './services/connectionService';
import { endIdleSessions } from './services/sessionService';

let broadcastInterval: ReturnType<typeof setInterval> | null = null;
let requestInterval: ReturnType<typeof setInterval> | null = null;
let sessionInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  broadcastInterval = setInterval(async () => {
    try {
      const ended = await endStalePlays();
      if (ended.length > 0) console.log(`Ended ${ended.length} stale plays`);
      const removed = await expireOldPlays();
      if (removed > 0) console.log(`Expired ${removed} old plays`);
    } catch (err) {
      console.error('Error expiring plays:', err);
    }
  }, 30_000);

  requestInterval = setInterval(async () => {
    try {
      const expired = await expireStaleRequests();
      if (expired > 0) console.log(`Expired ${expired} stale connection requests`);
    } catch (err) {
      console.error('Error expiring stale requests:', err);
    }
  }, 60_000);

  sessionInterval = setInterval(async () => {
    try {
      const ended = await endIdleSessions();
      if (ended > 0) console.log(`Ended ${ended} idle sessions`);
    } catch (err) {
      console.error('Error ending idle sessions:', err);
    }
  }, 60_000);

  console.log('Scheduler started');
}

export function stopScheduler(): void {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  if (requestInterval) {
    clearInterval(requestInterval);
    requestInterval = null;
  }
  if (sessionInterval) {
    clearInterval(sessionInterval);
    sessionInterval = null;
  }
  console.log('Scheduler stopped');
}
