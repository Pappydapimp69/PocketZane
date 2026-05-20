import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { createEntry } from '../api/entries';
import { theme } from '../lib/theme';

const MOOD_LABELS = ['Awful', 'Low', 'Okay', 'Good', 'Great'];

export function CaptureScreen(): JSX.Element {
  const [text, setText] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [showContext, setShowContext] = useState(false);
  const nav = useNavigation();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createEntry({
        raw_text: text.trim(),
        source_type: 'TEXT',
        client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        user_mood: mood,
        privacy_level: 'NORMAL',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['feed'] });
      nav.goBack();
    },
    onError: (err) => {
      Alert.alert('Could not save entry', err instanceof Error ? err.message : String(err));
    },
  });

  const canSubmit = text.trim().length > 0 && !mutation.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <View style={{ flex: 1, padding: theme.spacing.lg }}>
        <TextInput
          autoFocus
          multiline
          placeholder="What's on your mind?"
          placeholderTextColor={theme.textMuted}
          value={text}
          onChangeText={setText}
          style={{
            flex: 1,
            color: theme.text,
            fontSize: 18,
            lineHeight: 26,
            textAlignVertical: 'top',
            paddingVertical: theme.spacing.sm,
          }}
        />

        <Pressable
          onPress={() => setShowContext((v) => !v)}
          style={{ paddingVertical: theme.spacing.sm }}
        >
          <Text style={{ color: theme.textMuted }}>
            {showContext ? 'Hide context' : 'Add context'}
          </Text>
        </Pressable>

        {showContext ? (
          <View style={{ marginBottom: theme.spacing.md }}>
            <Text style={{ color: theme.textMuted, marginBottom: theme.spacing.sm }}>Mood</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MOOD_LABELS.map((label, i) => {
                const value = i + 1;
                const active = mood === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setMood(active ? null : value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: theme.radius,
                      backgroundColor: active ? theme.accent : theme.surface,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: active ? theme.accent : theme.border,
                    }}
                  >
                    <Text style={{ color: active ? theme.text : theme.textMuted, fontSize: 12 }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => mutation.mutate()}
          disabled={!canSubmit}
          style={{
            backgroundColor: canSubmit ? theme.accent : theme.surface,
            paddingVertical: 14,
            borderRadius: theme.radius,
            alignItems: 'center',
          }}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Save</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
