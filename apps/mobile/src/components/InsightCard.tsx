import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Insight } from '@signal/shared';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../lib/theme';

export function InsightCard({ insight }: { insight: Insight }): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => nav.navigate('InsightDetail', { insightId: insight.id })}
      style={{
        backgroundColor: theme.surfaceElev,
        borderRadius: theme.radius,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.accent,
      }}
    >
      <Text
        style={{
          color: theme.accent,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: theme.spacing.xs,
        }}
      >
        {insight.insight_type.replace(/_/g, ' ')}
      </Text>
      <Text
        style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: theme.spacing.sm }}
      >
        {insight.title}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 20 }} numberOfLines={4}>
        {insight.body}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: theme.spacing.md }}>
        confidence {Math.round(insight.confidence * 100)}% · {insight.evidence_entry_ids.length}{' '}
        entries
      </Text>
    </Pressable>
  );
}
