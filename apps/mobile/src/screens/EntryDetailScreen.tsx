import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { getEntry } from '../api/entries';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../lib/theme';

export function EntryDetailScreen(): JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, 'EntryDetail'>>();
  const query = useQuery({
    queryKey: ['entry', route.params.entryId],
    queryFn: () => getEntry(route.params.entryId),
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
        <Text style={{ color: theme.danger }}>Failed to load entry.</Text>
      </View>
    );
  }

  const { entry, extraction } = query.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: theme.spacing.sm }}>
        {new Date(entry.created_at).toLocaleString()}
      </Text>
      <Text style={{ color: theme.text, fontSize: 17, lineHeight: 25, marginBottom: theme.spacing.xl }}>
        {entry.raw_text}
      </Text>

      {extraction ? (
        <>
          {extraction.summary ? (
            <Section title="Summary">
              <Text style={{ color: theme.text, lineHeight: 22 }}>{extraction.summary}</Text>
            </Section>
          ) : null}

          {extraction.themes.length > 0 ? (
            <Section title="Themes">
              <Chips items={extraction.themes.map((t) => t.label)} />
            </Section>
          ) : null}

          {extraction.emotions.length > 0 ? (
            <Section title="Emotions">
              <Chips
                items={extraction.emotions.map((e) => `${e.label} (${e.intensity}/5)`)}
                tone="warn"
              />
            </Section>
          ) : null}

          {extraction.entities.length > 0 ? (
            <Section title="Entities">
              <Chips items={extraction.entities.map((e) => `${e.name} · ${e.type.toLowerCase()}`)} />
            </Section>
          ) : null}

          {extraction.contradictions.length > 0 ? (
            <Section title="Internal tensions">
              {extraction.contradictions.map((c, i) => (
                <Text key={i} style={{ color: theme.text, lineHeight: 22, marginBottom: 6 }}>
                  • {c.claim} ↔ {c.tension}
                </Text>
              ))}
            </Section>
          ) : null}
        </>
      ) : (
        <Text style={{ color: theme.textMuted }}>
          Extraction in progress. Pull to refresh in a few seconds.
        </Text>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <View style={{ marginBottom: theme.spacing.xl }}>
      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Chips({ items, tone }: { items: string[]; tone?: 'warn' }): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map((label, i) => (
        <View
          key={`${label}-${i}`}
          style={{
            backgroundColor: theme.surface,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: tone === 'warn' ? theme.danger : theme.border,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 12 }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
