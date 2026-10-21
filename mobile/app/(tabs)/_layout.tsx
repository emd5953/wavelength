import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { NearbyFeedProvider } from '../../src/services/nearbyFeed';
import { COLORS } from '../../src/components/ui';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const TABS: { name: string; title: string; icon: FeatherName }[] = [
  { name: 'nearby-feed', title: 'nearby', icon: 'radio' },
  { name: 'map', title: 'map', icon: 'map' },
  { name: 'connections', title: 'people', icon: 'users' },
  { name: 'profile', title: 'you', icon: 'user' },
];

/** The four main screens. Nearby and map share one feed subscription. */
export default function TabsLayout() {
  return (
    <NearbyFeedProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.ink,
          tabBarInactiveTintColor: COLORS.inkDim,
          tabBarStyle: { backgroundColor: COLORS.night, borderTopColor: COLORS.rule },
          tabBarLabelStyle: { fontFamily: 'PaperMono-Regular', fontSize: 11 },
          sceneStyle: { backgroundColor: COLORS.ground },
        }}
      >
        {TABS.map(({ name, title, icon }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarIcon: ({ color, size }) => <Feather name={icon} color={color} size={size - 2} />,
            }}
          />
        ))}
      </Tabs>
    </NearbyFeedProvider>
  );
}
