import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../store/auth';
import { AuthScreen } from '../screens/AuthScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { EntryDetailScreen } from '../screens/EntryDetailScreen';
import { InsightDetailScreen } from '../screens/InsightDetailScreen';
import { TabNavigator } from './TabNavigator';
import { theme } from '../lib/theme';

export type RootStackParamList = {
  Tabs: undefined;
  Capture: undefined;
  EntryDetail: { entryId: string };
  InsightDetail: { insightId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): JSX.Element {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="Capture"
        component={CaptureScreen}
        options={{ presentation: 'modal', title: 'New entry' }}
      />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ title: 'Entry' }} />
      <Stack.Screen
        name="InsightDetail"
        component={InsightDetailScreen}
        options={{ title: 'Insight' }}
      />
    </Stack.Navigator>
  );
}
