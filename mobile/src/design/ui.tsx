import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Slider from "@react-native-community/slider";
import { color, type } from "./theme";
export { color, type };

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
export function feedback(success = false) {
  const result = success
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.selectionAsync();
  result.catch(() => {});
}
export function Label({ style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[type.label, { color: color.muted, flexShrink: 1 }, style]}
    />
  );
}
export function Copy({ style, ...props }: TextProps) {
  return <Text {...props} style={[type.body, { color: color.paper }, style]} />;
}
export function Title({ style, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      {...props}
      style={[type.title, { color: color.paper }, style]}
    />
  );
}
export function Surface({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.surface, style]} />;
}
export function Icon({
  name,
  size = 22,
  tint = color.paper,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  tint?: string;
}) {
  return (
    <Feather
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={size}
      color={tint}
    />
  );
}

export function Button({
  title,
  onPress,
  secondary = false,
  busy = false,
  disabled = false,
  icon,
  style,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
  style?: ViewStyle;
  danger?: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    if (!reduced)
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start();
  };
  const tint = secondary ? (danger ? color.danger : color.paper) : color.ink;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={[
          styles.button,
          {
            backgroundColor: secondary ? color.raised : color.coral,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={tint} />
        ) : icon ? (
          <Icon name={icon} size={18} tint={tint} />
        ) : null}
        <Text
          style={{
            color: tint,
            fontSize: 15,
            flexShrink: 1,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {busy ? "Please wait…" : title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: color.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Wave({
  size = 24,
  tint = color.coral,
  animated = false,
}: {
  size?: number;
  tint?: string;
  animated?: boolean;
}) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animated || reduced) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 850,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, reduced]);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: size,
        flexDirection: "row",
        alignItems: "center",
        gap: size * 0.09,
      }}
    >
      {[0.25, 0.65, 1, 0.48, 0.8, 0.35, 0.18].map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: size * 0.1,
            height: size * h,
            backgroundColor: tint,
            borderRadius: size,
            transform: [
              {
                scaleY: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, i % 2 ? 0.55 : 1.12],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
export function Entrance({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const anim = Animated.timing(value, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
export function Artwork({
  uri,
  size = 64,
  title = "Album artwork",
}: {
  uri?: string;
  size?: number;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size > 100 ? 10 : 7,
        overflow: "hidden",
        backgroundColor: color.raised,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          accessibilityLabel={title}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Wave size={size * 0.4} tint={color.muted} />
      )}
    </View>
  );
}
export function Avatar({
  id,
  uri,
  size = 36,
}: {
  id: string;
  uri?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor:
          id.charCodeAt(id.length - 1) % 2 ? color.iceDim : color.coralDim,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Artwork uri={uri} size={size} title="Profile photo" />
      ) : (
        <Wave size={size * 0.45} tint={color.ice} />
      )}
    </View>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const router = useRouter();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: error ? color.coralDim : color.iceDim,
        padding: 14,
        borderRadius: 12,
        marginVertical: 8,
      }}
    >
      <Text style={[type.small, { color: error ? color.danger : color.ice }]}>
        {message}
      </Text>
      {error && message.includes("session has expired") && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/?signin=1")}
          style={{ minHeight: 44, justifyContent: "center", marginTop: 6 }}
        >
          <Text style={{ color: color.paper, fontWeight: "700" }}>
            Sign in again →
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function EmptyState({
  title,
  body,
  loading = false,
  action,
  onAction,
}: {
  title: string;
  body?: string;
  loading?: boolean;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        padding: 30,
        paddingVertical: 40,
        alignItems: "center",
        gap: 16,
      }}
    >
      <Wave size={48} animated={loading} />
      <Title style={{ textAlign: "center", fontSize: 25 }}>{title}</Title>
      {body && (
        <Copy style={{ color: color.muted, textAlign: "center" }}>{body}</Copy>
      )}
      {action && onAction && (
        <Button title={action} onPress={onAction} secondary />
      )}
    </View>
  );
}
export function RadiusControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <View>
      <View style={styles.row}>
        <Label>YOUR LISTENING RADIUS</Label>
        <Text style={{ color: color.coral, fontSize: 20, fontWeight: "700" }}>
          {draft} <Text style={{ fontSize: 13 }}>m</Text>
        </Text>
      </View>
      <Slider
        accessibilityLabel="Discovery radius in metres"
        accessibilityValue={{
          min: 50,
          max: 500,
          now: draft,
          text: `${draft} metres`,
        }}
        style={{ height: 44, marginHorizontal: -2 }}
        tapToSeek
        minimumValue={50}
        maximumValue={500}
        step={50}
        value={value}
        onValueChange={setDraft}
        onSlidingComplete={(v) => {
          feedback();
          onChange(v);
        }}
        minimumTrackTintColor={color.coral}
        maximumTrackTintColor={color.line}
        thumbTintColor={color.paper}
      />
      <View style={styles.row}>
        <Label style={{ fontSize: 10 }}>50 M · A LITTLE CLOSER</Label>
        <Label style={{ fontSize: 10 }}>500 M · EXPLORE</Label>
      </View>
    </View>
  );
}
export function BottomNav({
  active,
}: {
  active: "nearby" | "connections" | "profile";
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row",
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: color.ink,
        borderTopWidth: 1,
        borderTopColor: color.line,
      }}
    >
      {(
        [
          {
            key: "nearby",
            label: "Nearby",
            path: "/nearby-feed",
            icon: "radio",
          },
          {
            key: "connections",
            label: "Connections",
            path: "/connections",
            icon: "users",
          },
          { key: "profile", label: "You", path: "/profile", icon: "user" },
        ] as const
      ).map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === item.key }}
          accessibilityLabel={item.label}
          onPress={() => {
            if (active !== item.key) router.replace(item.path);
          }}
          style={{
            flex: 1,
            minHeight: 52,
            justifyContent: "center",
            alignItems: "center",
            gap: 5,
          }}
        >
          {item.key === "nearby" ? (
            <Wave
              size={22}
              tint={active === item.key ? color.coral : color.muted}
            />
          ) : (
            <Icon
              name={item.icon}
              size={21}
              tint={active === item.key ? color.coral : color.muted}
            />
          )}
          <Text
            style={{
              color: active === item.key ? color.coral : color.muted,
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) {
      y.setValue(reduced ? 0 : 600);
      Animated.spring(y, {
        toValue: 0,
        useNativeDriver: true,
        damping: 28,
        stiffness: 220,
        mass: 1,
      }).start();
    }
  }, [visible, reduced]);
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      gesture.dy > 6 && Math.abs(gesture.dx) < 20,
    onPanResponderMove: (_, gesture) => {
      if (!reduced) y.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 80 || gesture.vy > 0.9) onClose();
      else
        Animated.spring(y, {
          toValue: 0,
          useNativeDriver: true,
          damping: 28,
          stiffness: 220,
        }).start();
    },
  });
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#000000AA",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close track details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
            maxHeight: "91%",
            backgroundColor: color.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: y }],
          }}
        >
          <View
            {...pan.panHandlers}
            style={{ minHeight: 28, justifyContent: "center" }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: color.line,
                alignSelf: "center",
              }}
            />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  surface: { backgroundColor: color.surface, padding: 20, borderRadius: 20 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
