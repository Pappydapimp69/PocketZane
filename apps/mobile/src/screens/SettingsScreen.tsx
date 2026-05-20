import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useAuthStore } from '../store/auth';
import { deleteAccount, exportData } from '../api/me';
import { theme } from '../lib/theme';

export function SettingsScreen(): JSX.Element {
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);

  const onExport = async (): Promise<void> => {
    try {
      const payload = await exportData();
      await Share.share({
        title: 'Signal data export',
        message: JSON.stringify(payload, null, 2),
      });
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = (): void => {
    Alert.alert(
      'Delete everything?',
      'This permanently removes your account, entries, extractions, insights, and feedback. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await signOut();
            } catch (e) {
              Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: theme.spacing.xs }}>
        Signed in as
      </Text>
      <Text style={{ color: theme.text, fontSize: 16, marginBottom: theme.spacing.xl }}>
        {session?.user.email ?? '—'}
      </Text>

      <Row label="Export my data" onPress={onExport} />
      <Row label="Sign out" onPress={signOut} />
      <Row label="Delete account & all data" onPress={onDelete} danger />

      <View
        style={{
          marginTop: theme.spacing.xl,
          padding: theme.spacing.lg,
          backgroundColor: theme.surface,
          borderRadius: theme.radius,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 20 }}>
          Signal is not therapy and does not give medical advice. Insights are pattern
          observations, not diagnoses. Locked entries are excluded from insight generation.
        </Text>
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  danger?: boolean;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <Text style={{ color: danger ? theme.danger : theme.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
