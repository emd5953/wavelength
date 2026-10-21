import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Screen, PrimaryButton, TextButton } from '../src/components/ui';

const ONBOARDING_KEY = 'onboarding_complete';

const slides = [
  {
    lead: 'welcome to',
    title: 'wavelength',
    body: 'discover what people around you are listening to on spotify, in real time.',
  },
  {
    lead: 'let us show you',
    title: 'what’s playing\naround you',
    body: 'cafes, gyms, parks — anywhere nearby. people nearby can see where you’re listening on the map.',
  },
  {
    lead: 'say something',
    title: 'without saying\nwho you are',
    body: 'react, comment, and message listeners anonymously. send a connection request to share profiles.',
  },
  {
    lead: 'you decide',
    title: 'when to\nbe known',
    body: 'your identity stays hidden until you both choose to connect. delete your account and all data anytime.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);

  const finish = async () => {
    try { await SecureStore.setItemAsync(ONBOARDING_KEY, 'true'); } catch {}
    router.replace('/');
  };

  const handleNext = () => {
    if (page < slides.length - 1) setPage(page + 1);
    else finish();
  };

  const slide = slides[page];
  const last = page === slides.length - 1;

  return (
    <Screen className="px-8" style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <View className="flex-1 justify-center">
        <Text className="font-mono text-[15px] text-ink-dim mb-3">{slide.lead}</Text>
        <Text className="font-mono-light text-[34px] text-ink leading-[44px]">{slide.title}</Text>
        <Text className="font-mono text-[14px] text-ink-muted mt-6 leading-7">{slide.body}</Text>
      </View>

      {/* Progress */}
      <View className="flex-row gap-2 mb-8">
        {slides.map((_, i) => (
          <View key={i} className={`h-0.5 rounded-full ${i === page ? 'w-8 bg-ink' : 'w-2 bg-rule'}`} />
        ))}
      </View>

      <View className="flex-row items-center gap-6">
        {last ? <View className="w-12" /> : <TextButton label="skip" onPress={finish} className="w-12" />}
        <PrimaryButton label={last ? 'get started' : 'continue'} onPress={handleNext} className="flex-1" />
      </View>
    </Screen>
  );
}

export { ONBOARDING_KEY };
