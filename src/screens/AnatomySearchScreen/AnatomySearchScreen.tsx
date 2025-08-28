import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useVectorSearch } from '../../hooks/useVectorSearch';
import { SearchResult } from '../../services/VectorService';

export const AnatomySearchScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const { search, searchResults, isLoading, error, isReady, getAllChunks } = useVectorSearch();
  const [showAllContent, setShowAllContent] = useState(false);
  const [allChunks, setAllChunks] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Search Query Required', 'Please enter a search term');
      return;
    }
    
    try {
      await search(query.trim(), 10); // Get top 10 results
    } catch (err) {
      console.error('Search error:', err);
      Alert.alert('Search Error', 'Failed to search. Please try again.');
    }
  };

  const handleShowAllContent = async () => {
    try {
      const chunks = await getAllChunks();
      setAllChunks(chunks);
      setShowAllContent(true);
    } catch (err) {
      console.error('Error loading all content:', err);
      Alert.alert('Error', 'Failed to load content');
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <View style={styles.resultItem}>
      <Text style={styles.resultText}>{item.chunk.text}</Text>
      <View style={styles.resultMeta}>
        <Text style={styles.metaText}>Page: {item.chunk.page}</Text>
        <Text style={styles.metaText}>
          Match: {(item.similarity * 100).toFixed(1)}%
        </Text>
      </View>
    </View>
  );

  const renderChunk = ({ item }: { item: any }) => (
    <View style={styles.resultItem}>
      <Text style={styles.resultText}>{item.text}</Text>
      <View style={styles.resultMeta}>
        <Text style={styles.metaText}>Page: {item.page}</Text>
        <Text style={styles.metaText}>ID: {item.id}</Text>
      </View>
    </View>
  );

  if (!isReady && isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Anatomy Database...</Text>
        <Text style={styles.subText}>This may take a moment on first load</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧠 Anatomy Search</Text>
        <Text style={styles.subtitle}>Search through HY MSK Anatomy content</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search anatomy content (e.g., 'muscle', 'bone', 'nerve')..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity 
          style={[styles.searchButton, (!query.trim() || isLoading) && styles.disabledButton]} 
          onPress={handleSearch}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={handleShowAllContent}
        >
          <Text style={styles.secondaryButtonText}>
            {showAllContent ? 'Show Search Results' : 'Browse All Content'}
          </Text>
        </TouchableOpacity>
        
        {searchResults.length > 0 && (
          <Text style={styles.resultsCount}>
            {searchResults.length} results found
          </Text>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <FlatList
        data={showAllContent ? allChunks : searchResults}
        renderItem={showAllContent ? renderChunk : renderSearchResult}
        keyExtractor={(item) => showAllContent ? item.id : item.chunk.id}
        style={styles.resultsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {showAllContent 
                ? 'No content loaded' 
                : query 
                  ? 'No results found. Try different keywords.' 
                  : 'Enter a search term to find anatomy content'
              }
            </Text>
          </View>
        }
      />
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          📚 {isReady ? '1174 anatomy chunks available' : 'Loading...'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginRight: 8,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 80,
  },
  disabledButton: {
    backgroundColor: '#adb5bd',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  resultsCount: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#495057',
    fontWeight: '500',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6c757d',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    color: '#212529',
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  metaText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
});