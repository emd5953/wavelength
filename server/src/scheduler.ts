import { expireStaleBroadcasts } from './services/broadcastService';
import { expireStaleRequests } from './services/connectionService';

let broadcastInterval: ReturnType<typeof setInterval> | null = null;
let requestInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  broadcastInterval = setInterval(async () => {
    try {
      const removed = await expireStaleBroadcasts();
      if (removed > 0) console.log(`Expired ${removed} stale broadcasts`);
    } catch (err) {
      console.error('Error expiring stale broadcasts:', err);
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
  console.log('Scheduler stopped');
}
