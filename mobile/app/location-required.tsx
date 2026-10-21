import { Text, View, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, PrimaryButton } from '../src/components/ui';

export default function LocationRequiredScreen() {
  const insets = useSafeAreaInsets();

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <Screen className="px-8" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <View className="flex-1 justify-center">
        <Text className="font-mono-light text-[32px] text-ink leading-[42px]">wavelength needs{'\n'}your location.</Text>
        <Text className="font-mono text-[14px] text-ink-muted mt-6 leading-7">
          it's how we find what's playing around you, and how people nearby see where you're listening on the map.
        </Text>
      </View>
      <PrimaryButton label="open settings" onPress={openSettings} />
    </Screen>
  );
}
