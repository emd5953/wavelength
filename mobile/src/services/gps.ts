import * as Location from 'expo-location';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';
export type PositionCallback = (position: GeoPosition) => void;

/**
 * GPS module for the mobile client.
 * Handles location permissions, current position, and position watching.
 * Requirements: 2.1, 2.5
 */
export const GPSModule = {
  /**
   * Request foreground location permission.
   * Returns the resulting permission status.
   */
  async requestPermission(): Promise<PermissionStatus> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return 'granted';
    if (status === Location.PermissionStatus.DENIED) return 'denied';
    return 'undetermined';
  },

  /**
   * Check current permission status without prompting.
   */
  async checkPermission(): Promise<PermissionStatus> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return 'granted';
    if (status === Location.PermissionStatus.DENIED) return 'denied';
    return 'undetermined';
  },

  /**
   * Get the device's current position.
   * Throws if permission is not granted.
   */
  async getCurrentPosition(): Promise<GeoPosition> {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return toGeoPosition(location);
  },

  /**
   * Watch position changes. Returns a subscription object
   * that can be removed to stop watching.
   */
  watchPosition(callback: PositionCallback): Location.LocationSubscription | null {
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // meters
      },
      (location) => {
        callback(toGeoPosition(location));
      },
    ).then((sub) => {
      subscription = sub;
    });

    // Return a proxy that will remove the subscription when available
    return {
      remove: () => {
        subscription?.remove();
      },
    } as Location.LocationSubscription;
  },
};

function toGeoPosition(location: Location.LocationObject): GeoPosition {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 0,
    timestamp: location.timestamp,
  };
}
