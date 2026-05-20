import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Entry, Extraction } from '@signal/shared';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../lib/theme';

export function EntryCard({
  entry,
  extraction,
}: {
  entry: Entry;
  extraction: Extraction | null;
}): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const date = new Date(entry.created_at);
  const themes = (extraction?.themes ?? []).slice(0, 3);

  return (
    <Pressable
      onPress={() => nav.navigate('EntryDetail', { entryId: entry.id })}
      style={{
        backgroundColor: theme.surface,
        borderRadius: theme.radius,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: theme.spacing.xs }}>
        {formatDate(date)}
      </Text>
      <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }} numberOfLines={4}>
        {entry.raw_text}
      </Text>
      {themes.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: theme.spacing.md,
          }}
        >
          {themes.map((t) => (
            <View
              key={t.label}
              style={{
                backgroundColor: theme.surfaceElev,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
