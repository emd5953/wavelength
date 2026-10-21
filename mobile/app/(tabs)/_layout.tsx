import { Tabs } from 'expo-router';
import { NearbyFeedProvider } from '../../src/services/nearbyFeed';
import TabBar from '../../src/components/TabBar';
import { COLORS } from '../../src/components/ui';

const TABS = ['nearby-feed', 'map', 'connections', 'profile'];

/** The four main screens. Nearby and map share one feed subscription. */
export default function TabsLayout() {
  return (
    <NearbyFeedProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: COLORS.ground } }}
      >
        {TABS.map((name) => (
          <Tabs.Screen key={name} name={name} />
        ))}
      </Tabs>
    </NearbyFeedProvider>
  );
}
