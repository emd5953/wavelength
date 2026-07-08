import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'onboarding_complete';

const slides = [
  {
    emoji: '🎵',
    title: 'Welcome to\nWavelength',
    body: 'Discover what people around you are listening to on Spotify — in real time.',
    gradient: ['#DC2626', '#B91C1C', '#1a0a0a'] as const,
  },
  {
    emoji: '📍',
    title: 'Location-Based\nDiscovery',
    body: 'See music playing in cafes, gyms, parks — anywhere nearby. Your exact location is never shared.',
    gradient: ['#B91C1C', '#991B1B', '#1a0a0a'] as const,
  },
  {
    emoji: '💬',
    title: 'Connect\nAnonymously',
    body: 'React, comment, and message listeners without revealing who you are. Send a connection request to share profiles.',
    gradient: ['#EF4444', '#DC2626', '#1a0a0a'] as const,
  },
  {
    emoji: '🔒',
    title: 'Privacy\nFirst',
    body: 'Your identity stays hidden until you choose to connect. Delete your account and all data anytime.',
    gradient: ['#991B1B', '#7F1D1D', '#1a0a0a'] as const,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);

  const handleNext = async () => {
    if (page < slides.length - 1) {
      setPage(page + 1);
    } else {
      try { await SecureStore.setItemAsync(ONBOARDING_KEY, 'true'); } catch {}
      router.replace('/');
    }
  };

  const slide = slides[page];

  return (
    <LinearGradient colors={[...slide.gradient]} locations={[0, 0.4, 1]} className="flex-1">
      <View className="flex-1 justify-between px-8 pt-24 pb-12">
        <View className="flex-1 justify-center">
          <View
            className="w-20 h-20 rounded-2xl items-center justify-center mb-8"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <Text style={{ fontSize: 38 }}>{slide.emoji}</Text>
          </View>

          <Text className="text-4xl font-extrabold text-white leading-[46px] mb-5">
            {slide.title}
          </Text>
          <Text className="text-base text-white/70 leading-7">
            {slide.body}
          </Text>
        </View>

        <View>
          {/* Progress dots */}
          <View className="flex-row gap-2 mb-8">
            {slides.map((_, i) => (
              <View
                key={i}
                className="h-1 rounded-full"
                style={{
                  width: i === page ? 32 : 8,
                  backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </View>

          <TouchableOpacity
            className="w-full py-4 rounded-2xl items-center"
            style={{
              backgroundColor: '#fff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            }}
            onPress={handleNext}
            accessibilityRole="button"
          >
            <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '800' }}>
              {page < slides.length - 1 ? 'Continue' : 'Get Started'}
            </Text>
          </TouchableOpacity>

          {page < slides.length - 1 && (
            <TouchableOpacity
              className="items-center mt-4"
              onPress={async () => {
                try { await SecureStore.setItemAsync(ONBOARDING_KEY, 'true'); } catch {}
                router.replace('/');
              }}
              accessibilityRole="button"
            >
              <Text className="text-white/40 text-sm">Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

export { ONBOARDING_KEY };
