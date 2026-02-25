import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { SpotifyAuthModule } from './spotifyAuth';

const TASK_NAME = 'wavelength-background-location';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[0];
    if (!loc) return;

    try {
      const token = await SpotifyAuthModule.getValidToken();
      if (!token) return;

      await fetch(`${API_BASE}/account/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }),
      });
    } catch (err) {
      console.error('Background location POST failed:', err);
    }
  }
});

export async function startBackgroundLocation(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') return false;

  const isStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (isStarted) return true;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,
    distanceInterval: 50,
    deferredUpdatesInterval: 60_000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Wavelength',
      notificationBody: 'Sharing your location for nearby music discovery',
    },
  });

  return true;
}

export async function stopBackgroundLocation(): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}
