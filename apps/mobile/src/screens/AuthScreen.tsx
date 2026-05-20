import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuthStore } from '../store/auth';
import { theme } from '../lib/theme';

export function AuthScreen(): JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const submit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <View style={{ flex: 1, padding: theme.spacing.xl, justifyContent: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 32, fontWeight: '700', marginBottom: 4 }}>
          Signal
        </Text>
        <Text style={{ color: theme.textMuted, marginBottom: theme.spacing.xl }}>
          A journal that notices the patterns you would not.
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />

        {error ? (
          <Text style={{ color: theme.danger, marginBottom: theme.spacing.md }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={submitting}
          style={{
            backgroundColor: theme.accent,
            paddingVertical: 14,
            borderRadius: theme.radius,
            alignItems: 'center',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}
        >
          <Text style={{ color: theme.textMuted }}>
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: theme.surface,
  color: theme.text,
  borderColor: theme.border,
  borderWidth: 1,
  borderRadius: theme.radius,
  padding: 14,
  marginBottom: theme.spacing.md,
  fontSize: 16,
} as const;
