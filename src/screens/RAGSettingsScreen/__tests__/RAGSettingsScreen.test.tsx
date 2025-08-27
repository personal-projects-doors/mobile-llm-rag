import React from 'react';
import {fireEvent, render, waitFor, act} from '../../../../jest/test-utils';

import {RAGSettingsScreen} from '../RAGSettingsScreen';
import {ragStore} from '../../../store';

// Mock the RAG store
jest.mock('../../../store', () => ({
  ragStore: {
    initialize: jest.fn(),
    chunkSize: 512,
    overlap: 50,
    maxResults: 5,
    minSimilarity: 0.7,
    preserveSentences: true,
    isInitialized: true,
    isLoading: false,
    error: null,
    setChunkSize: jest.fn(),
    setOverlap: jest.fn(),
    setMaxResults: jest.fn(),
    setMinSimilarity: jest.fn(),
    setPreserveSentences: jest.fn(),
    resetToDefaults: jest.fn(),
    clearError: jest.fn(),
    getPerformanceImpact: jest.fn(() => 'medium'),
    getPerformanceDescription: jest.fn(() => 'Moderate impact on processing speed and memory usage'),
  },
}));

jest.useFakeTimers();

describe('RAGSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders RAG settings screen correctly', async () => {
    const {getByText, getByDisplayValue} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    expect(getByText('Performance Impact')).toBeTruthy();
    expect(getByText('Document Processing')).toBeTruthy();
    expect(getByText('Retrieval Configuration')).toBeTruthy();
    expect(getByDisplayValue('512')).toBeTruthy();
    expect(getByDisplayValue('50')).toBeTruthy();
  });

  it('updates chunk size correctly', async () => {
    const {getByDisplayValue} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const chunkSizeInput = getByDisplayValue('512');
    
    act(() => {
      fireEvent.changeText(chunkSizeInput, '1024');
    });

    act(() => {
      jest.advanceTimersByTime(600); // Advance past debounce delay
    });

    await waitFor(() => {
      expect(ragStore.setChunkSize).toHaveBeenCalledWith(1024);
    });
  });

  it('displays error for invalid chunk size input', async () => {
    const {getByDisplayValue, getByText} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const chunkSizeInput = getByDisplayValue('512');
    
    act(() => {
      fireEvent.changeText(chunkSizeInput, '50'); // Invalid: too small
    });

    expect(getByText('Chunk size must be between 100 and 2000 tokens')).toBeTruthy();
  });

  it('updates overlap correctly', async () => {
    const {getByDisplayValue} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const overlapInput = getByDisplayValue('50');
    
    act(() => {
      fireEvent.changeText(overlapInput, '100');
    });

    act(() => {
      jest.advanceTimersByTime(600); // Advance past debounce delay
    });

    await waitFor(() => {
      expect(ragStore.setOverlap).toHaveBeenCalledWith(100);
    });
  });

  it('displays error for invalid overlap input', async () => {
    const {getByDisplayValue, getByText} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const overlapInput = getByDisplayValue('50');
    
    act(() => {
      fireEvent.changeText(overlapInput, '600'); // Invalid: larger than chunk size
    });

    expect(getByText('Overlap must be between 0 and chunk size')).toBeTruthy();
  });

  it('toggles preserve sentences switch', async () => {
    const {getByTestId} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const preserveSentencesSwitch = getByTestId('preserve-sentences-switch');
    
    fireEvent(preserveSentencesSwitch, 'onValueChange', false);

    expect(ragStore.setPreserveSentences).toHaveBeenCalledWith(false);
  });

  it('updates max results slider', async () => {
    const {getByTestId} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const maxResultsSlider = getByTestId('max-results-slider');
    
    fireEvent(maxResultsSlider, 'onValueChange', 10);

    expect(ragStore.setMaxResults).toHaveBeenCalledWith(10);
  });

  it('updates min similarity slider', async () => {
    const {getByTestId} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const minSimilaritySlider = getByTestId('min-similarity-slider');
    
    fireEvent(minSimilaritySlider, 'onValueChange', 0.8);

    expect(ragStore.setMinSimilarity).toHaveBeenCalledWith(0.8);
  });

  it('shows performance impact indicator', async () => {
    const {getByText} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    expect(getByText('MEDIUM')).toBeTruthy();
    expect(getByText('Moderate impact on processing speed and memory usage')).toBeTruthy();
  });

  it('handles reset to defaults', async () => {
    const {getByText} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const resetButton = getByText('Reset to Defaults');
    fireEvent.press(resetButton);

    // Should show confirmation dialog
    expect(getByText('Reset to Defaults')).toBeTruthy();
    expect(getByText('Are you sure you want to reset all RAG settings to their default values?')).toBeTruthy();

    // Confirm reset
    const confirmButton = getByText('Reset');
    fireEvent.press(confirmButton);

    expect(ragStore.resetToDefaults).toHaveBeenCalled();
  });

  it('displays error message when store has error', async () => {
    // Mock store with error
    (ragStore as any).error = 'Test error message';

    const {getByText} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    expect(getByText('Test error message')).toBeTruthy();
    
    const dismissButton = getByText('Dismiss');
    fireEvent.press(dismissButton);

    expect(ragStore.clearError).toHaveBeenCalled();
  });

  it('expands and collapses advanced settings', async () => {
    const {getByText} = render(<RAGSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const advancedSettingsButton = getByText('Advanced Settings');
    fireEvent.press(advancedSettingsButton);

    expect(getByText('Settings Migration')).toBeTruthy();
    expect(getByText('Performance Optimization')).toBeTruthy();

    // Collapse
    fireEvent.press(advancedSettingsButton);
  });
});