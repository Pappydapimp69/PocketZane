import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FeedbackType, Insight } from '@signal/shared';
import { getInsight, submitFeedback } from '../api/insights';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../lib/theme';

const POSITIVE: { label: string; type: FeedbackType }[] = [
  { label: 'Accurate', type: 'accurate' },
  { label: 'Important', type: 'important' },
  { label: 'Save', type: 'save' },
];
const NEGATIVE: { label: string; type: FeedbackType }[] = [
  { label: 'Partially', type: 'partially_accurate' },
  { label: 'Wrong', type: 'wrong' },
  { label: 'Boring', type: 'boring' },
  { label: 'Uncomfortable', type: 'uncomfortable' },
];

export function InsightDetailScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'InsightDetail'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const qc = useQueryClient();
  const [submittedType, setSubmittedType] = useState<FeedbackType | null>(null);

  const query = useQuery<Insight>({
    queryKey: ['insight', route.params.insightId],
    queryFn: () => getInsight(route.params.insightId),
  });

  const mutation = useMutation({
    mutationFn: (type: FeedbackType) =>
      submitFeedback(route.params.insightId, { feedback_type: type }),
    onSuccess: async (_data, type) => {
      setSubmittedType(type);
      await qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (query.isError || !query.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.danger }}>Failed to load insight.</Text>
      </View>
    );
  }
  const insight = query.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <Text
        style={{
          color: theme.accent,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: theme.spacing.sm,
        }}
      >
        {insight.insight_type.replace(/_/g, ' ')} · confidence {Math.round(insight.confidence * 100)}%
      </Text>
      <Text
        style={{ color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: theme.spacing.md }}
      >
        {insight.title}
      </Text>
      <Text style={{ color: theme.text, fontSize: 16, lineHeight: 24, marginBottom: theme.spacing.xl }}>
        {insight.body}
      </Text>

      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: theme.spacing.sm,
        }}
      >
        Evidence ({insight.evidence_entry_ids.length} entries)
      </Text>
      {insight.evidence_entry_ids.map((id) => (
        <Pressable
          key={id}
          onPress={() => nav.navigate('EntryDetail', { entryId: id })}
          style={{
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Text style={{ color: theme.text }} numberOfLines={1}>
            View entry {id.slice(0, 8)}…
          </Text>
        </Pressable>
      ))}

      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: theme.spacing.xl,
          marginBottom: theme.spacing.sm,
        }}
      >
        How does this land?
      </Text>
      <ButtonRow buttons={POSITIVE} onPress={mutation.mutate} active={submittedType} />
      <ButtonRow buttons={NEGATIVE} onPress={mutation.mutate} active={submittedType} />

      {mutation.isPending ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: theme.spacing.md }} />
      ) : null}
      {submittedType ? (
        <Text style={{ color: theme.success, marginTop: theme.spacing.md }}>
          Recorded: {submittedType}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function ButtonRow({
  buttons,
  onPress,
  active,
}: {
  buttons: { label: string; type: FeedbackType }[];
  onPress: (t: FeedbackType) => void;
  active: FeedbackType | null;
}): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm }}>
      {buttons.map((b) => {
        const isActive = active === b.type;
        return (
          <Pressable
            key={b.type}
            onPress={() => onPress(b.type)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: theme.radius,
              backgroundColor: isActive ? theme.accent : theme.surface,
              borderWidth: 1,
              borderColor: isActive ? theme.accent : theme.border,
            }}
          >
            <Text style={{ color: theme.text }}>{b.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
