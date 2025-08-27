import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {RAGOnboarding} from '../RAGOnboarding';
import {TestWrapper} from '../../../../jest/test-utils';

describe('RAGOnboarding', () => {
  const defaultProps = {
    visible: true,
    onDismiss: jest.fn(),
    onGetStarted: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const {getByText} = render(
      <TestWrapper>
        <RAGOnboarding {...defaultProps} />
      </TestWrapper>
    );

    expect(getByText('Welcome to RAG')).toBeTruthy();
    expect(getByText('Upload Documents')).toBeTruthy();
    expect(getByText('AI Processing')).toBeTruthy();
    expect(getByText('Enhanced Conversations')).toBeTruthy();
  });

  it('calls onDismiss when skip button is pressed', () => {
    const {getByText} = render(
      <TestWrapper>
        <RAGOnboarding {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.press(getByText('Skip Tutorial'));
    expect(defaultProps.onDismiss).toHaveBeenCalled();
  });

  it('calls onGetStarted when get started button is pressed on last step', () => {
    const {getByText} = render(
      <TestWrapper>
        <RAGOnboarding {...defaultProps} />
      </TestWrapper>
    );

    // Navigate to last step
    fireEvent.press(getByText('Next'));
    fireEvent.press(getByText('Next'));
    
    // Should show "Get Started" button on last step
    fireEvent.press(getByText('Get Started'));
    expect(defaultProps.onGetStarted).toHaveBeenCalled();
  });

  it('navigates between steps correctly', () => {
    const {getByText} = render(
      <TestWrapper>
        <RAGOnboarding {...defaultProps} />
      </TestWrapper>
    );

    // Should start on first step
    expect(getByText('Upload Documents')).toBeTruthy();

    // Navigate to second step
    fireEvent.press(getByText('Next'));
    expect(getByText('AI Processing')).toBeTruthy();

    // Navigate back
    fireEvent.press(getByText('Previous'));
    expect(getByText('Upload Documents')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const {queryByText} = render(
      <TestWrapper>
        <RAGOnboarding {...defaultProps} visible={false} />
      </TestWrapper>
    );

    expect(queryByText('Welcome to RAG')).toBeNull();
  });
});