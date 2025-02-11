import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Searchbar, Button, List, Avatar, Divider, useTheme } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { router } from 'expo-router';
import { Community } from '../../types/community';

export function Sidebar() {
  const { supabase, user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  const fetchJoinedCommunities = async () => {
    if (!user) return;

    try {
      // First get the communities where the user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        // Get the community details for all joined communities
        const communityIds = memberData.map(m => m.community_id);
        const { data: communitiesData, error: communitiesError } = await supabase
          .from('communities')
          .select(`
            id,
            name,
            description,
            cover_image,
            member_count,
            is_private,
            creator_id,
            created_at
          `)
          .in('id', communityIds);

        if (communitiesError) throw communitiesError;
        setCommunities(communitiesData || []);
      } else {
        setCommunities([]);
      }
    } catch (error) {
      console.error('Error fetching communities:', error);
      alert('Failed to load communities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJoinedCommunities();
  }, [user]);

  const filteredCommunities = communities.filter(community =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Communities</Text>
      </View>
      <Divider />
      
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search communities"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <Button
          mode="contained"
          icon="plus"
          onPress={() => router.push('/create-community')}
          style={styles.createButton}
        >
          Create New
        </Button>
      </View>

      <ScrollView style={styles.communitiesList}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text>Loading communities...</Text>
          </View>
        ) : filteredCommunities.length > 0 ? (
          filteredCommunities.map((community) => (
            <List.Item
              key={community.id}
              title={community.name}
              description={community.description || 'No description'}
              left={(props) => (
                community.cover_image ? (
                  <Avatar.Image
                    {...props}
                    size={40}
                    source={{ uri: community.cover_image }}
                  />
                ) : (
                  <Avatar.Icon
                    {...props}
                    size={40}
                    icon="account-group"
                    color="#FFFFFF"
                    style={{ backgroundColor: '#007AFF' }}
                  />
                )
              )}
              onPress={() => router.push(`/community/${community.id}`)}
              style={styles.communityItem}
              titleStyle={styles.communityTitle}
              descriptionStyle={styles.communityDescription}
              descriptionNumberOfLines={1}
              right={(props) => (
                <Text style={styles.memberCount}>
                  {community.member_count} {community.member_count === 1 ? 'member' : 'members'}
                </Text>
              )}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No communities found' : 'No communities joined yet'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 16,
    paddingTop: 20,
    marginTop: 50,
  },
  title: {
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    gap: 12,
  },
  searchBar: {
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  createButton: {
    borderRadius: 8,
  },
  communitiesList: {
    flex: 1,
  },
  communityItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  communityDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  memberCount: {
    fontSize: 12,
    opacity: 0.5,
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666666',
  },
}); 