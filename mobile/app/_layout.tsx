import "../global.css";
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { LogBox } from 'react-native';
import { cssInterop } from 'nativewind';
import { COLORS } from '../src/components/ui';

// NativeWind only maps className -> style on components it knows about.
// Without this, className on LinearGradient is dropped and every gradient
// screen collapses to its content height.
cssInterop(LinearGradient, { className: 'style' });

// Simulators can't get push tokens; this dev-only warning would sit over the tab bar.
LogBox.ignoreLogs(['expo-notifications: obtaining a push token']);

// Paper Mono (SIL OFL 1.1, assets/fonts/paper-mono/OFL.txt). Each weight is
// its own family because React Native can't synthesize weights for custom
// fonts; Tailwind exposes them as font-mono-light / font-mono / -medium / -semibold.
const FONTS = {
  'PaperMono-Light': require('../assets/fonts/paper-mono/PaperMono-Light.ttf'),
  'PaperMono-Regular': require('../assets/fonts/paper-mono/PaperMono-Regular.ttf'),
  'PaperMono-Medium': require('../assets/fonts/paper-mono/PaperMono-Medium.ttf'),
  'PaperMono-SemiBold': require('../assets/fonts/paper-mono/PaperMono-SemiBold.ttf'),
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);

  // Render nothing for the few ms the fonts take, rather than flashing the
  // system font. If loading fails, fall back to the system font.
  if (!fontsLoaded && !fontError) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.ground },
        headerTintColor: COLORS.inkMuted,
        headerTitleStyle: { color: COLORS.ink, fontFamily: 'PaperMono-Regular', fontSize: 15 },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.ground },
      }}
    >
      <Stack.Screen name="onboarding" options={{ title: 'Welcome', headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'Wavelength', headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="play" options={{ headerShown: false }} />
      <Stack.Screen name="dm" options={{ title: '' }} />
      <Stack.Screen name="connection-detail" options={{ title: '' }} />
      <Stack.Screen name="chat" options={{ title: '' }} />
      <Stack.Screen name="connection-requests" options={{ title: '' }} />
      <Stack.Screen name="location-required" options={{ title: 'location', headerShown: false }} />
    </Stack>
  );
}
