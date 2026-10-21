import { useEffect, useState } from 'react';
import { View, Text, Image, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { getMyAnonId } from '../src/services/presence';
import { getRememberedPlay } from '../src/services/nearbyFeed';
import CommentThread from '../src/components/CommentThread';
import Reactions from '../src/components/Reactions';
import { Back, Note } from '../src/components/icons';
import { PressableScale, SPRING } from '../src/components/motion';
import { COLORS } from '../src/components/ui';

/** One play: the cover, who's playing it, reactions, and the thread. */
export default function PlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { broadcastId } = useLocalSearchParams<{ broadcastId: string }>();
  const play = broadcastId ? getRememberedPlay(broadcastId) : undefined;
  const [viewerAnonId, setViewerAnonId] = useState('');

  // The cover settles in from slightly small, standing in for a shared-element transition
  const scale = useSharedValue(0.94);
  const coverStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    scale.value = withSpring(1, SPRING.settle);
  }, [scale]);

  useEffect(() => {
    getMyAnonId().then((id) => {
      if (id) setViewerAnonId(id);
    });
  }, []);

  if (!broadcastId || !viewerAnonId) return <View className="flex-1 bg-ground" />;

  // Opened without going through the feed (e.g. a deep link): comments only
  if (!play) return <CommentThread broadcastId={broadcastId} viewerAnonId={viewerAnonId} />;

  const details = (
    <View>
      <Animated.View style={[{ width, height: width }, coverStyle]}>
        {play.albumArtUrl ? <Image source={{ uri: play.albumArtUrl }} style={{ width: '100%', height: '100%' }} /> : null}
      </Animated.View>

      <Animated.View entering={FadeIn.delay(120)} className="px-6 pt-6">
        <View className="flex-row items-start">
          <View className="flex-1 pr-4">
            <Text className="font-mono-light text-[26px] text-ink" numberOfLines={2}>{play.trackTitle}</Text>
            <View className="flex-row items-center mt-1.5">
              {play.isLive && <View className="w-1.5 h-1.5 rounded-full bg-live mr-2" />}
              <Text className="font-mono text-[15px] text-ink-muted" numberOfLines={1}>{play.artistName}</Text>
            </View>
          </View>
          {play.anonymousId ? (
            <PressableScale
              scaleTo={0.88}
              onPress={() => router.push(`/dm?recipientAnonId=${play.anonymousId}`)}
              accessibilityLabel="Message the listener"
              style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: COLORS.rule, alignItems: 'center', justifyContent: 'center' }}
            >
              <Note size={24} color={COLORS.ink} />
            </PressableScale>
          ) : null}
        </View>

        <View className="mt-8 mb-6">
          <Reactions broadcastId={play.id} />
        </View>
        <View className="h-px bg-rule mb-2" />
      </Animated.View>
    </View>
  );

  return (
    <View className="flex-1 bg-ground">
      <CommentThread broadcastId={play.id} viewerAnonId={viewerAnonId} header={details} />
      <View style={{ position: 'absolute', top: insets.top + 6, left: 14 }}>
        <PressableScale
          scaleTo={0.88}
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(5,31,51,0.55)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Back size={22} color={COLORS.ink} />
        </PressableScale>
      </View>
    </View>
  );
}
