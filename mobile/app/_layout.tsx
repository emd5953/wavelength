import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#fff',
        headerTitleStyle: { color: '#fff' },
        contentStyle: { backgroundColor: '#121212' },
      }}
    >
      <Stack.Screen name="onboarding" options={{ title: 'Welcome', headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'Wavelength', headerShown: false }} />
      <Stack.Screen name="nearby-feed" options={{ title: 'Nearby' }} />
      <Stack.Screen name="comment-thread" options={{ title: 'Comments' }} />
      <Stack.Screen name="dm" options={{ title: 'Message' }} />
      <Stack.Screen name="connections" options={{ title: 'Connections' }} />
      <Stack.Screen name="connection-detail" options={{ title: 'Profile' }} />
      <Stack.Screen name="connection-requests" options={{ title: 'Requests' }} />
      <Stack.Screen name="location-required" options={{ title: 'Location Required' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
    </Stack>
  );
}
