import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { FeedItem } from '@signal/shared';
import { getFeed } from '../api/feed';
import { EntryCard } from '../components/EntryCard';
import { InsightCard } from '../components/InsightCard';
import { theme } from '../lib/theme';

export function FeedScreen(): JSX.Element {
  const query = useQuery({ queryKey: ['feed'], queryFn: getFeed });

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.danger }}>
          {query.error instanceof Error ? query.error.message : 'Failed to load feed.'}
        </Text>
      </View>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <FlatList<FeedItem>
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 160 }}
      data={items}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      renderItem={({ item }) =>
        item.type === 'ENTRY' ? (
          <EntryCard entry={item.entry} extraction={item.extraction} />
        ) : (
          <InsightCard insight={item.insight} />
        )
      }
      ListEmptyComponent={
        <View style={{ paddingVertical: 64, alignItems: 'center' }}>
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 14,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            Capture a fragment to start. Signal looks for patterns once you have a handful of entries.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching && !query.isLoading}
          onRefresh={() => query.refetch()}
          tintColor={theme.accent}
        />
      }
    />
  );
}
