import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'onboarding_complete';

const slides = [
  {
    emoji: '🎵',
    title: 'Welcome to Wavelength',
    body: 'Discover what people around you are listening to on Spotify.',
  },
  {
    emoji: '📍',
    title: 'Location-Based Discovery',
    body: 'See music playing in your area. Your exact location is never shared — we fuzz it to protect your privacy.',
  },
  {
    emoji: '🤝',
    title: 'Connect Anonymously',
    body: 'React, comment, and message listeners anonymously. Send a connection request to reveal profiles.',
  },
  {
    emoji: '🔒',
    title: 'Your Privacy Matters',
    body: 'Your identity stays hidden until you choose to connect. You can delete your account and all data anytime.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);

  const handleNext = async () => {
    if (page < slides.length - 1) {
      setPage(page + 1);
    } else {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      router.replace('/');
    }
  };

  const slide = slides[page];

  return (
    <View className="flex-1 justify-center items-center p-8 bg-surface">
      <Text className="text-6xl mb-6">{slide.emoji}</Text>
      <Text className="text-2xl font-bold text-white text-center mb-3">{slide.title}</Text>
      <Text className="text-base text-muted-light text-center leading-6 mb-8">{slide.body}</Text>

      <View className="flex-row gap-2 mb-8">
        {slides.map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${i === page ? 'w-6 bg-spotify' : 'w-2 bg-muted-border'}`}
          />
        ))}
      </View>

      <TouchableOpacity className="bg-spotify px-12 py-3.5 rounded-3xl mb-4" onPress={handleNext}>
        <Text className="text-white text-base font-bold">
          {page < slides.length - 1 ? 'Next' : 'Get Started'}
        </Text>
      </TouchableOpacity>

      {page < slides.length - 1 && (
        <TouchableOpacity
          onPress={async () => {
            await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
            router.replace('/');
          }}
        >
          <Text className="text-muted-dark text-sm">Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export { ONBOARDING_KEY };
