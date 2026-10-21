import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  LayoutAnimation,
  AppState,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { GPSModule } from "../src/services/gps";
import {
  ApiError,
  fetchNearbyFeed,
  FeedBroadcast,
  friendlyError,
  updateLocation,
} from "../src/services/api";
import {
  connectFeedSocket,
  sendLocationUpdate,
  disconnectFeedSocket,
} from "../src/services/feedSocket";
import { startPresence, stopPresence } from "../src/services/presence";
import { startBackgroundLocation } from "../src/services/backgroundLocation";
import { registerForPushNotifications } from "../src/services/pushNotifications";
import BroadcastCard from "../src/components/BroadcastCard";
import FeedMap from "../src/components/FeedMap";
import TrackSheet from "../src/components/TrackSheet";
import {
  BottomNav,
  Button,
  Copy,
  EmptyState,
  Icon,
  IconButton,
  Label,
  Notice,
  RadiusControl,
  Wave,
  color,
  styles,
  type,
  useReducedMotion,
} from "../src/design/ui";
import {
  Coordinate,
  RADIUS_KEY,
  sortFeed,
  validRadius,
} from "../src/utils/discovery";
import { DEMO_MODE, demoLocation } from "../src/dev/demo";
export default function NearbyFeedScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const { previewState } = useLocalSearchParams<{ previewState?: string }>();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [radius, setRadius] = useState(100);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [selected, setSelected] = useState<FeedBroadcast | null>(null);
  const radiusRef = useRef(100);
  const listOffset = useRef(0);
  const generation = useRef(0);
  const initialized = useRef(false);
  const active = useRef(false);
  const loadingRef = useRef(false);
  const loadFeed = useCallback(async () => {
    if (!active.current || loadingRef.current) return;
    loadingRef.current = true;
    const current = ++generation.current;
    try {
      if (!DEMO_MODE && (await GPSModule.requestPermission()) !== "granted") {
        router.replace("/location-required");
        return;
      }
      const pos = DEMO_MODE
        ? demoLocation
        : await GPSModule.getCurrentPosition();
      if (DEMO_MODE && previewState === "offline")
        throw new TypeError("Preview network outage");
      const data =
        DEMO_MODE && previewState === "empty"
          ? { broadcasts: [] }
          : await fetchNearbyFeed(
              pos.latitude,
              pos.longitude,
              radiusRef.current,
            );
      if (!active.current || current !== generation.current) return;
      if (!reduced)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLocation(pos);
      setBroadcasts(sortFeed(data.broadcasts));
      setError("");
      setExpired(false);
      if (!DEMO_MODE) {
        sendLocationUpdate(
          "anonymous",
          pos.latitude,
          pos.longitude,
          radiusRef.current,
        );
        if (!initialized.current) {
          initialized.current = true;
          startPresence();
          startBackgroundLocation().catch(() => {});
          registerForPushNotifications().catch(() => {});
        }
        updateLocation(pos.latitude, pos.longitude).catch(() => {});
      }
    } catch (e) {
      if (active.current && current === generation.current) {
        setError(friendlyError(e));
        setExpired(e instanceof ApiError && e.status === 401);
      }
    } finally {
      if (current === generation.current) {
        loadingRef.current = false;
        if (active.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
  }, [reduced, previewState]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      SecureStore.getItemAsync(DEMO_MODE ? "demo_discovery_radius" : RADIUS_KEY)
        .then((saved) => {
          if (active.current) {
            radiusRef.current = validRadius(saved);
            setRadius(radiusRef.current);
            loadFeed();
          }
        })
        .catch(() => loadFeed());
      if (!DEMO_MODE)
        connectFeedSocket({
          onBroadcastNew: () => loadFeed(),
          onBroadcastEnded: () => loadFeed(),
        });
      const interval = setInterval(() => {
        if (AppState.currentState === "active") loadFeed();
      }, 10000);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") loadFeed();
      });
      return () => {
        active.current = false;
        generation.current++;
        loadingRef.current = false;
        clearInterval(interval);
        sub.remove();
        stopPresence();
        initialized.current = false;
        disconnectFeedSocket();
      };
    }, [loadFeed]),
  );
  const changeRadius = async (value: number) => {
    try {
      await SecureStore.setItemAsync(
        DEMO_MODE ? "demo_discovery_radius" : RADIUS_KEY,
        String(value),
      );
      radiusRef.current = value;
      setRadius(value);
      generation.current++;
      loadingRef.current = false;
      setRefreshing(true);
      loadFeed();
    } catch {
      setError("Couldn’t save your radius. Please try again.");
    }
  };
  const liveCount = broadcasts.filter((b) => b.isLive).length;
  const refresh = () => {
    setRefreshing(true);
    loadFeed();
  };
  const heading = (
    <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 6 }}>
      <View style={styles.row}>
        <Label style={{ color: color.coral }}>
          TUNE INTO YOUR SURROUNDINGS
        </Label>
        <Wave size={24} animated={loading} />
      </View>
      {viewMode === "list" && !error && (loading || broadcasts.length > 0) && (
        <>
          <Text
            accessibilityRole="header"
            style={[
              type.display,
              {
                color: color.paper,
                marginTop: 12,
                fontSize: fontScale > 1.2 ? 36 : 48,
                lineHeight: fontScale > 1.2 ? 40 : 50,
              },
            ]}
          >
            {"The sound\nof the room"}
            <Text style={{ color: color.coral }}>.</Text>
          </Text>
          <Copy style={{ color: color.muted, marginTop: 12, marginBottom: 22 }}>
            Different people. A shared frequency.
          </Copy>
        </>
      )}
      <View
        style={[
          styles.row,
          {
            paddingTop: viewMode === "map" ? 12 : 0,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderColor: color.line,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: color.paper,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: -1,
            }}
          >
            {loading || (error && !broadcasts.length)
              ? "—"
              : liveCount.toString().padStart(2, "0")}{" "}
            <Text
              style={{
                color: color.muted,
                fontSize: 13,
                fontWeight: "400",
                letterSpacing: 0,
              }}
            >
              {error
                ? broadcasts.length
                  ? "last seen playing"
                  : "activity unavailable"
                : "playing now"}
            </Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Discovery radius ${radius} metres. Adjust radius`}
          accessibilityState={{ expanded: radiusOpen }}
          onPress={() => setRadiusOpen(!radiusOpen)}
          style={{
            minHeight: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: color.line,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Icon name="sliders" size={14} tint={color.coral} />
          <Text style={{ color: color.paper, fontSize: 13 }}>{radius} m</Text>
          <Icon
            name={radiusOpen ? "chevron-up" : "chevron-down"}
            size={14}
            tint={color.muted}
          />
        </Pressable>
      </View>
      {radiusOpen && (
        <View style={{ paddingVertical: 18 }}>
          <RadiusControl value={radius} onChange={changeRadius} />
        </View>
      )}
      {error && (
        <>
          <Notice
            error
            message={
              broadcasts.length
                ? `${error} Showing the last available activity.`
                : error
            }
          />
          {!expired && <Button title="Try again" secondary onPress={refresh} />}
        </>
      )}
      <View style={[styles.row, { marginTop: 20, marginBottom: 4 }]}>
        <Label>
          {viewMode === "map" ? "THE NEIGHBOURHOOD" : "NEARBY ROTATION"}
        </Label>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: color.surface,
            borderRadius: 12,
            padding: 3,
          }}
        >
          {(["list", "map"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityLabel={`${mode} view`}
              accessibilityState={{ selected: viewMode === mode }}
              onPress={() => {
                if (!reduced)
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                setViewMode(mode);
              }}
              style={{
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor:
                  viewMode === mode ? color.raised : "transparent",
              }}
            >
              <Icon
                name={mode === "list" ? "list" : "map"}
                size={15}
                tint={viewMode === mode ? color.paper : color.muted}
              />
              <Text
                style={{
                  color: viewMode === mode ? color.paper : color.muted,
                  fontSize: 12,
                }}
              >
                {mode === "list" ? "List" : "Map"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.row,
          { paddingHorizontal: 24, paddingTop: DEMO_MODE ? 8 : insets.top + 8 },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Wave size={23} />
          <Text
            style={{
              color: color.paper,
              fontSize: 20,
              letterSpacing: -0.7,
              fontWeight: "700",
            }}
          >
            wavelength
          </Text>
        </View>
        <IconButton
          name="inbox"
          label="Connection requests"
          onPress={() => router.push("/connection-requests")}
        />
      </View>
      {viewMode === "list" ? (
        <FlatList
          data={broadcasts}
          contentOffset={{ x: 0, y: listOffset.current }}
          onScroll={(event) => {
            listOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={100}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={heading}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={color.coral}
            />
          }
          renderItem={({ item, index }) => (
            <View>
              {!item.isLive &&
                (index === 0 || broadcasts[index - 1].isLive) && (
                  <Label style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                    RECENT ECHOES · LAST 6 HOURS
                  </Label>
                )}
              <BroadcastCard
                broadcast={item}
                location={location}
                index={index}
                onPress={setSelected}
              />
            </View>
          )}
          ListEmptyComponent={
            !error ? (
              <EmptyState
                loading={loading}
                title={
                  loading ? "Finding the room’s rhythm" : "A quiet moment."
                }
                body={
                  loading
                    ? "Looking for music around you."
                    : "Good music is worth finding. Widen your radius, visit a busier spot, or check back in a little while."
                }
                action={
                  loading
                    ? undefined
                    : radius < 500
                      ? "Widen to 500 m"
                      : "Listen again"
                }
                onAction={() => (radius < 500 ? changeRadius(500) : refresh())}
              />
            ) : null
          }
        />
      ) : (
        <View style={{ flex: 1 }}>
          {heading}
          <FeedMap
            broadcasts={broadcasts}
            userLocation={location}
            radius={radius}
            onSelect={setSelected}
          />
        </View>
      )}
      <BottomNav active="nearby" />
      <TrackSheet
        play={
          selected
            ? (broadcasts.find((p) => p.id === selected.id) ?? selected)
            : null
        }
        location={location}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
