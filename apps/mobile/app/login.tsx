import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace('/(tabs)/feed');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#F5451F' }}>StoryMe</Text>
        <Text style={{ color: '#6B7A96', marginBottom: 12 }}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />
        {error && <Text style={{ color: '#E23A45' }}>{error}</Text>}
        <Pressable onPress={submit} disabled={busy} style={buttonStyle}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Text>}
        </Pressable>
        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text style={{ color: '#F5451F', textAlign: 'center', marginTop: 8 }}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#CBD2DE',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
} as const;

const buttonStyle = {
  backgroundColor: '#F5451F',
  borderRadius: 10,
  paddingVertical: 14,
  alignItems: 'center',
} as const;
