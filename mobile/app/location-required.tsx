import { Text, View, TouchableOpacity, Linking, Platform } from 'react-native';

/**
 * Screen shown when GPS permission is denied.
 * Explains why location is needed and links to device settings.
 * Requirement 2.5
 */
export default function LocationRequiredScreen() {
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View className="flex-1 justify-center items-center p-8 bg-surface">
      <Text className="text-[22px] font-bold mb-4 text-center text-white">
        Location Access Required
      </Text>
      <Text className="text-base text-center text-muted-light mb-6 leading-6">
        Wavelength needs your location to discover what people
        near you are listening to. Without location access, the nearby feed and
        broadcasting features cannot work.
      </Text>
      <TouchableOpacity
        className="bg-spotify px-6 py-3 rounded-lg"
        onPress={openSettings}
      >
        <Text className="text-white text-base font-bold">Open Settings</Text>
      </TouchableOpacity>
    </View>
  );
}
