import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ComicStyle, COMIC_LIMITS } from '@storyme/shared-types';
import type { Character } from '@storyme/api-client';
import { api } from '@/lib/api';

const STYLES = Object.values(ComicStyle);

export default function Create() {
  const qc = useQueryClient();
  const characters = useQuery({ queryKey: ['characters'], queryFn: () => api.listCharacters() });
  const [characterId, setCharacterId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<string>(ComicStyle.Manga);

  const createComic = useMutation({
    mutationFn: () =>
      api.createComic(
        { characterId, prompt, style: style as never, panelCount: COMIC_LIMITS.DEFAULT_PANELS },
        String(Date.now()),
      ),
    onSuccess: (comic) => router.push(`/comic/${comic.id}`),
    onError: (e) => Alert.alert('Could not create comic', (e as Error).message),
  });

  const createCharacter = useMutation({
    mutationFn: async (name: string) => {
      const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.8, selectionLimit: 5 });
      if (res.canceled || res.assets.length === 0) throw new Error('No photos selected');
      const uploadIds: string[] = [];
      for (const asset of res.assets) {
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const sizeBytes = asset.fileSize ?? 1_000_000;
        const { uploadId, uploadUrl } = await api.createUpload({ mimeType, sizeBytes });
        const blob = await (await fetch(asset.uri)).blob();
        await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': mimeType } });
        await api.completeUpload(uploadId);
        uploadIds.push(uploadId);
      }
      return api.createCharacter({ name, kind: 'person', uploadIds, consent: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters'] }),
    onError: (e) => Alert.alert('Upload failed', (e as Error).message),
  });

  const [newName, setNewName] = useState('');

  if (characters.isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {(characters.data?.length ?? 0) === 0 ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Create your hero</Text>
          <TextInput placeholder="Character name" value={newName} onChangeText={setNewName} style={inputStyle} />
          <Pressable
            style={buttonStyle}
            disabled={!newName || createCharacter.isPending}
            onPress={() => createCharacter.mutate(newName)}
          >
            {createCharacter.isPending ? <ActivityIndicator color="#fff" /> : <Text style={btnText}>Pick photos & create</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Create a comic</Text>
          <Text style={label}>Hero</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {characters.data!.map((c: Character) => (
              <Chip key={c.id} active={characterId === c.id} label={c.name} onPress={() => setCharacterId(c.id)} />
            ))}
          </View>
          <Text style={label}>Your story</Text>
          <TextInput
            placeholder="A brave astronaut explores a candy planet…"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            style={[inputStyle, { height: 100, textAlignVertical: 'top' }]}
          />
          <Text style={label}>Art style</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STYLES.map((s) => (
              <Chip key={s} active={style === s} label={s} onPress={() => setStyle(s)} />
            ))}
          </View>
          <Pressable
            style={buttonStyle}
            disabled={!characterId || prompt.length < COMIC_LIMITS.MIN_PROMPT_CHARS || createComic.isPending}
            onPress={() => createComic.mutate()}
          >
            {createComic.isPending ? <ActivityIndicator color="#fff" /> : <Text style={btnText}>Generate comic ✨</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: active ? '#F5451F' : '#CBD2DE',
        backgroundColor: active ? '#FFE0DC' : '#fff',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: active ? '#A9270C' : '#374357', textTransform: 'capitalize' }}>{label}</Text>
    </Pressable>
  );
}

const inputStyle = { borderWidth: 1, borderColor: '#CBD2DE', borderRadius: 10, padding: 12 } as const;
const buttonStyle = { backgroundColor: '#F5451F', borderRadius: 10, paddingVertical: 14, alignItems: 'center' } as const;
const btnText = { color: '#fff', fontWeight: '700' } as const;
const label = { fontWeight: '600', color: '#232D42' } as const;
