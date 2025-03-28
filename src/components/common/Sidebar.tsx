import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Button, List, Avatar, Divider, useTheme } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { router } from 'expo-router';
import { Community } from '../../types/community';
import { useActiveCommunity } from '../../context/ActiveCommunityContext';

export function Sidebar() {
  const { supabase, user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const { activeCommunityId, setActiveCommunityId } = useActiveCommunity();

  const fetchJoinedCommunities = async () => {
    if (!user) return;

    try {
      // Get communities where user is a member
      const { data: userCommunities, error: membershipError } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (membershipError) throw membershipError;

      const communityIds = userCommunities.map(uc => uc.community_id);

      // Get community details
      const { data: communitiesData, error: communitiesError } = await supabase
        .from('communities')
        .select(`
          id,
          name,
          description,
          cover_image,
          is_private,
          creator_id,
          created_at,
          updated_at
        `)
        .in('id', communityIds);

      if (communitiesError) throw communitiesError;

      // Get all active members for these communities
      const { data: allMembers, error: membersError } = await supabase
        .from('community_members')
        .select('community_id')
        .in('community_id', communityIds)
        .eq('status', 'active');

      if (membersError) throw membersError;

      // Count members for each community
      const memberCounts = communityIds.reduce((acc, communityId) => {
        acc[communityId] = allMembers.filter(m => m.community_id === communityId).length;
        return acc;
      }, {} as Record<string, number>);

      // Combine the data
      const communitiesWithCounts = communitiesData.map(community => ({
        ...community,
        member_count: memberCounts[community.id] || 0
      }));

      setCommunities(communitiesWithCounts);
      
      // Set first community as active by default if none selected
      if (!activeCommunityId && communitiesWithCounts.length > 0) {
        setActiveCommunityId(communitiesWithCounts[0].id);
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

  // Add this effect to listen for member count changes
  useEffect(() => {
    const channel = supabase
      .channel('member_count_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_members'
        },
        () => {
          fetchJoinedCommunities(); // Refresh when members change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text>Loading communities...</Text>
        </View>
      ) : (
        <ScrollView style={styles.communitiesList}>
          {communities
            .filter(community =>
              community.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(community => (
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
                onPress={() => setActiveCommunityId(community.id)}
                style={[
                  styles.communityItem,
                  activeCommunityId === community.id && styles.activeCommunityItem
                ]}
                titleStyle={[
                  styles.communityTitle,
                  activeCommunityId === community.id && styles.activeCommunityTitle
                ]}
                descriptionStyle={styles.communityDescription}
                descriptionNumberOfLines={1}
                right={(props) => (
                  <Text style={[
                    styles.memberCount,
                    activeCommunityId === community.id && styles.activeMemberCount
                  ]}>
                    {community.member_count} {community.member_count === 1 ? 'member' : 'members'}
                  </Text>
                )}
              />
            ))}
        </ScrollView>
      )}
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
  activeCommunityItem: {
    backgroundColor: '#007AFF15',
    borderRadius: 8,
  },
  activeCommunityTitle: {
    color: '#007AFF',
    fontWeight: '700',
  },
  activeMemberCount: {
    color: '#007AFF',
    opacity: 0.8,
  },
}); 