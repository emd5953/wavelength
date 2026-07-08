import { Text, View, TouchableOpacity, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LocationRequiredScreen() {
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <LinearGradient colors={['#DC2626', '#B91C1C', '#1a0a0a']} locations={[0, 0.4, 1]} className="flex-1 justify-center items-center px-8">
      <View
        className="w-20 h-20 rounded-2xl items-center justify-center mb-6"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
      >
        <Text style={{ fontSize: 38 }}>📍</Text>
      </View>

      <Text className="text-2xl font-extrabold text-white text-center mb-3">
        Location Access Required
      </Text>
      <Text className="text-base text-white/60 text-center leading-6 mb-8">
        Wavelength needs your location to discover what people near you are listening to. Your exact location is never shared with other users.
      </Text>

      <TouchableOpacity
        className="w-full py-4 rounded-2xl items-center"
        style={{
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        }}
        onPress={openSettings}
        accessibilityRole="button"
      >
        <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '800' }}>Open Settings</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}
