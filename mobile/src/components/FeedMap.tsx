import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import { DEMO_MODE } from "../dev/demo";
import type { FeedBroadcast } from "../services/api";
import {
  Artwork,
  Copy,
  EmptyState,
  Icon,
  color,
  styles,
  useReducedMotion,
} from "../design/ui";
import { Coordinate, groupMarkers, listenerName } from "../utils/discovery";
interface Props {
  broadcasts: FeedBroadcast[];
  userLocation: Coordinate | null;
  radius: number;
  onSelect: (play: FeedBroadcast) => void;
}
export default function FeedMap({
  broadcasts,
  userLocation,
  radius,
  onSelect,
}: Props) {
  const map = useRef<MapView>(null);
  const reduced = useReducedMotion();
  const [latitudeDelta, setLatitudeDelta] = useState(radius / 35000);
  const [mapHeight, setMapHeight] = useState(400);
  // Keep touchable markers separated as the map zooms; coordinates stay exact.
  const threshold = Math.max(18, (latitudeDelta * 111320 * 56) / mapHeight);
  const groups = useMemo(
    () => groupMarkers(broadcasts, threshold),
    [broadcasts, threshold],
  );
  const [selection, setSelection] = useState<string | null>(null);
  const selected = groups.find((g) => g.plays.some((p) => p.id === selection));
  useEffect(() => {
    if (userLocation)
      map.current?.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: radius / 35000,
          longitudeDelta: radius / 27000,
        },
        reduced ? 0 : 300,
      );
  }, [radius, userLocation?.latitude, userLocation?.longitude, reduced]);
  if (!userLocation)
    return (
      <EmptyState
        title="Waiting for your location"
        body="Your surroundings will appear here once location is available."
      />
    );
  return (
    <View
      style={{ flex: 1, minHeight: 120 }}
      onLayout={(event) =>
        setMapHeight(Math.max(120, event.nativeEvent.layout.height))
      }
    >
      <MapView
        ref={map}
        style={{ flex: 1 }}
        userInterfaceStyle="dark"
        showsUserLocation={!DEMO_MODE}
        showsPointsOfInterest={false}
        initialRegion={{
          ...userLocation,
          latitudeDelta: radius / 35000,
          longitudeDelta: radius / 27000,
        }}
        onRegionChangeComplete={(region) =>
          setLatitudeDelta(region.latitudeDelta)
        }
        onPress={() => setSelection(null)}
      >
        <Circle
          center={userLocation}
          radius={radius}
          fillColor="#FF806D10"
          strokeColor="#FF806D70"
          strokeWidth={1}
        />
        {groups.map((g) => (
          <Marker
            key={g.plays[0].id}
            coordinate={g.coordinate}
            onPress={(event) => {
              event.stopPropagation();
              setSelection(g.plays[0].id);
            }}
            accessibilityLabel={`${g.plays.length} ${g.plays.length === 1 ? "play" : "plays"} at this location`}
          >
            <View
              style={{
                borderWidth: 2,
                borderColor: selected === g ? color.paper : color.coral,
                borderRadius: 14,
                backgroundColor: selected === g ? color.coral : color.surface,
                padding: 7,
                minWidth: 48,
                minHeight: 48,
                justifyContent: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon
                name="music"
                tint={selected === g ? color.ink : color.coral}
                size={22}
              />
              {g.plays.length > 1 && (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: selected === g ? color.ink : color.paper,
                  }}
                >
                  {g.plays.length}
                </Text>
              )}
            </View>
          </Marker>
        ))}
      </MapView>
      <View
        style={{
          position: "absolute",
          top: 12,
          left: 20,
          right: 20,
          backgroundColor: color.ink,
          borderRadius: 12,
          padding: 12,
        }}
      >
        <Copy style={{ fontSize: 12, color: color.muted, lineHeight: 18 }}>
          Exact listening locations are visible. Numbered markers group nearby
          plays.
        </Copy>
      </View>
      {selected && (
        <View
          style={{
            position: "absolute",
            bottom: 16,
            left: 20,
            right: 20,
            maxHeight: 210,
            backgroundColor: color.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: color.line,
          }}
        >
          <ScrollView>
            {selected.plays.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${p.trackTitle} from ${listenerName(p.anonymousId)}`}
                onPress={() => onSelect(p)}
                style={[styles.row, { padding: 14 }]}
              >
                <Artwork uri={p.albumArtUrl} size={48} />
                <View style={{ flex: 1 }}>
                  <Copy style={{ fontWeight: "700" }} numberOfLines={1}>
                    {p.trackTitle}
                  </Copy>
                  <Copy style={{ fontSize: 11, color: color.muted }}>
                    {listenerName(p.anonymousId)} ·{" "}
                    {p.isLive ? "Playing now" : "Recent play"}
                  </Copy>
                </View>
                <Icon name="arrow-up-right" size={18} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
