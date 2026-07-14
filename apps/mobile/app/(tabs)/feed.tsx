import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { api, mediaUrl } from '@/lib/api';

export default function Feed() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['discover'],
    queryFn: () => api.discover({ limit: 20 }),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item) => item.id}
      onRefresh={refetch}
      refreshing={isRefetching}
      contentContainerStyle={{ padding: 12, gap: 16 }}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', color: '#6B7A96', marginTop: 40 }}>No stories yet.</Text>
      }
      renderItem={({ item }) => {
        const cover = mediaUrl(item.coverKey);
        return (
          <Link href={`/comic/${item.id}`} asChild>
            <Pressable style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E9ECF1' }}>
              {cover ? (
                <Image source={{ uri: cover }} style={{ width: '100%', height: 220 }} />
              ) : (
                <View style={{ height: 220, backgroundColor: '#E9ECF1', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 44 }}>{item.format === 'reel' ? '🎬' : '📖'}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
                <Text style={{ fontWeight: '700' }}>{item.title ?? 'Untitled'}</Text>
                <Text style={{ color: '#6B7A96' }}>❤️ {item.likeCount}  💬 {item.commentCount}</Text>
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
