/** Message bubble and composer shared by comments and DMs. */

import type { ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { COLORS } from './ui';

/** Mine: primary fill, right. Theirs: card, left. */
export function Bubble({ mine, author, children }: { mine: boolean; author?: string; children: ReactNode }) {
  return (
    <View className={`mx-4 my-1 ${mine ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[80%] px-4 py-3 rounded-[14px] ${mine ? 'bg-primary rounded-br-sm' : 'bg-card border border-rule rounded-bl-sm'}`}
      >
        {!mine && author ? (
          <Text className="font-mono text-[11px] text-ink-dim mb-1">{author}</Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

export function BubbleText({ text }: { text: string }) {
  return <Text className="font-mono text-[14px] text-ink leading-[22px]">{text}</Text>;
}

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  inputLabel: string;
  sendLabel: string;
}

export function Composer({ value, onChangeText, onSend, sending, placeholder, inputLabel, sendLabel }: ComposerProps) {
  const ready = value.trim().length > 0 && !sending;
  return (
    <View className="flex-row items-center p-3 bg-night border-t border-rule">
      <TextInput
        className="flex-1 rounded-full px-4 py-2.5 font-mono text-[14px] text-ink bg-card border border-rule"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.inkDim}
        accessibilityLabel={inputLabel}
      />
      <TouchableOpacity
        className="ml-3 px-2 py-2.5"
        onPress={onSend}
        disabled={!ready}
        accessibilityLabel={sendLabel}
        accessibilityRole="button"
      >
        <Text className={`font-mono-medium text-[14px] ${ready ? 'text-ink' : 'text-ink-dim'}`}>send</Text>
      </TouchableOpacity>
    </View>
  );
}
