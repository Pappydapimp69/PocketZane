import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FeedScreen } from '../screens/FeedScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { theme } from '../lib/theme';
import type { RootStackParamList } from './RootNavigator';

const Tab = createBottomTabNavigator();

export function TabNavigator(): JSX.Element {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
        }}
      >
        <Tab.Screen name="Feed" component={FeedScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
      <Pressable
        onPress={() => nav.navigate('Capture')}
        accessibilityRole="button"
        accessibilityLabel="New entry"
        style={{
          position: 'absolute',
          right: 20,
          bottom: 88,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Text style={{ color: theme.text, fontSize: 28, fontWeight: '600' }}>+</Text>
      </Pressable>
    </View>
  );
}
