import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import type { Panel } from '@storyme/api-client';
import { api, mediaUrl } from '@/lib/api';

export default function ComicReader() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['comic', id],
    queryFn: () => api.getComic(id),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && s !== 'complete' && s !== 'failed' && s !== 'moderated' ? 2000 : false;
    },
  });

  if (isLoading || !data) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  const generating = data.status === 'queued' || data.status === 'processing';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>{data.title ?? 'Your comic'}</Text>
      {generating && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: '#6B7A96' }}>Creating your comic… this updates automatically.</Text>
        </View>
      )}
      {data.panels.map((panel: Panel) => {
        const uri = mediaUrl(panel.imageKey);
        return (
          <View key={panel.id} style={{ borderWidth: 3, borderColor: '#0B0F18', borderRadius: 8, overflow: 'hidden' }}>
            {uri ? (
              <Image source={{ uri }} style={{ width: '100%', aspectRatio: 1 }} />
            ) : (
              <View style={{ height: 200, backgroundColor: '#E9ECF1', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#6B7A96' }}>Panel {panel.index + 1}…</Text>
              </View>
            )}
            {panel.dialogue?.length > 0 && (
              <View style={{ backgroundColor: '#fff', padding: 10 }}>
                {panel.dialogue.map((d: { speaker?: string; text: string }, i: number) => (
                  <Text key={i}>
                    <Text style={{ fontWeight: '700' }}>{d.speaker ?? 'Narrator'}: </Text>
                    {d.text}
                  </Text>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
