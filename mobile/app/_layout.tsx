import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1DB954' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Music Vicinity' }} />
      <Stack.Screen name="nearby-feed" options={{ title: 'Nearby' }} />
      <Stack.Screen name="comment-thread" options={{ title: 'Comments' }} />
      <Stack.Screen name="dm" options={{ title: 'Message' }} />
      <Stack.Screen name="connections" options={{ title: 'Connections' }} />
      <Stack.Screen name="connection-detail" options={{ title: 'Profile' }} />
      <Stack.Screen name="connection-requests" options={{ title: 'Requests' }} />
      <Stack.Screen name="location-required" options={{ title: 'Location Required' }} />
    </Stack>
  );
}
