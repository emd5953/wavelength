import { Text, View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';

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
    <View style={styles.container}>
      <Text style={styles.title}>Location Access Required</Text>
      <Text style={styles.body}>
        Music Vicinity Matchmaker needs your location to discover what people
        near you are listening to. Without location access, the nearby feed and
        broadcasting features cannot work.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={openSettings}
        accessibilityRole="button"
        accessibilityLabel="Open device settings to enable location access"
      >
        <Text style={styles.buttonText}>Open Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
