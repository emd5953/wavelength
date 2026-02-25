import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

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
    <View style={styles.container}>
      <Text style={styles.emoji}>{slide.emoji}</Text>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.activeDot]} />
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleNext}>
        <Text style={styles.btnText}>
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
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#121212',
  },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 16, color: '#aaa', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#444' },
  activeDot: { backgroundColor: '#1DB954', width: 24 },
  btn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 16,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  skip: { color: '#666', fontSize: 14 },
});

export { ONBOARDING_KEY };
