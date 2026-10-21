import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { FeedBroadcast } from "../services/api";
import {
  Artwork,
  Avatar,
  Entrance,
  Icon,
  Label,
  color,
  styles,
} from "../design/ui";
import {
  Coordinate,
  distanceLabel,
  listenerName,
  timeAgo,
} from "../utils/discovery";
interface Props {
  broadcast: FeedBroadcast;
  location: Coordinate | null;
  index?: number;
  onPress: (play: FeedBroadcast) => void;
}
export default memo(function BroadcastCard({
  broadcast: b,
  location,
  index = 0,
  onPress,
}: Props) {
  return (
    <Entrance delay={Math.min(index, 4) * 45}>
      <TouchableOpacity
        onPress={() => onPress(b)}
        accessibilityRole="button"
        accessibilityLabel={`${b.trackTitle} by ${b.artistName}. ${listenerName(b.anonymousId)}. ${b.isLive ? "Playing now" : "Recently played"}. ${distanceLabel(location, b.location)}. Open track details.`}
        style={{
          marginHorizontal: 24,
          paddingVertical: 20,
          borderBottomWidth: 1,
          borderBottomColor: color.line,
        }}
      >
        <View style={[styles.row, { marginBottom: 12 }]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flex: 1,
            }}
          >
            <Avatar id={b.anonymousId} size={23} />
            <Text style={{ color: color.muted, fontSize: 12, flexShrink: 1 }}>
              {listenerName(b.anonymousId)}
            </Text>
          </View>
          <Text style={{ color: color.muted, fontSize: 12 }}>
            {distanceLabel(location, b.location)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Artwork
            uri={b.albumArtUrl}
            size={b.isLive ? 88 : 68}
            title={`Cover for ${b.trackTitle}`}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: color.paper,
                fontSize: b.isLive ? 21 : 18,
                lineHeight: 25,
                fontWeight: "700",
                letterSpacing: -0.5,
              }}
              numberOfLines={2}
            >
              {b.trackTitle}
            </Text>
            <Text
              style={{ color: color.muted, fontSize: 14 }}
              numberOfLines={2}
            >
              {b.artistName}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 5,
              }}
            >
              {b.isLive ? (
                <Label
                  style={{
                    color: color.coral,
                    fontSize: 9,
                    letterSpacing: 1.2,
                  }}
                >
                  ● PLAYING NOW
                </Label>
              ) : (
                <Text style={{ color: color.muted, fontSize: 11 }}>
                  Played {timeAgo(b.endedAt ?? b.startedAt)}
                </Text>
              )}
              {b.tasteScore != null && b.tasteScore > 0 && (
                <Text style={{ color: color.ice, fontSize: 11 }}>
                  {b.tasteScore}% taste match
                </Text>
              )}
            </View>
          </View>
          <Icon name="arrow-up-right" size={19} tint={color.muted} />
        </View>
      </TouchableOpacity>
    </Entrance>
  );
});
