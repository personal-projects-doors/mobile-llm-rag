import {useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'rag_onboarding_completed';
const TOOLTIP_KEY = 'rag_tooltip_shown';

export const useRAGOnboarding = () => {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [tooltipShown, setTooltipShown] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOnboardingState = async () => {
      try {
        const [onboardingValue, tooltipValue] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(TOOLTIP_KEY),
        ]);
        
        setOnboardingCompleted(onboardingValue === 'true');
        setTooltipShown(tooltipValue === 'true');
      } catch (error) {
        console.error('Failed to load RAG onboarding state:', error);
        setOnboardingCompleted(false);
        setTooltipShown(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadOnboardingState();
  }, []);

  const markOnboardingCompleted = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setOnboardingCompleted(true);
    } catch (error) {
      console.error('Failed to save onboarding completion:', error);
    }
  };

  const markTooltipShown = async () => {
    try {
      await AsyncStorage.setItem(TOOLTIP_KEY, 'true');
      setTooltipShown(true);
    } catch (error) {
      console.error('Failed to save tooltip shown state:', error);
    }
  };

  const resetOnboarding = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(ONBOARDING_KEY),
        AsyncStorage.removeItem(TOOLTIP_KEY),
      ]);
      setOnboardingCompleted(false);
      setTooltipShown(false);
    } catch (error) {
      console.error('Failed to reset onboarding state:', error);
    }
  };

  return {
    onboardingCompleted,
    tooltipShown,
    isLoading,
    markOnboardingCompleted,
    markTooltipShown,
    resetOnboarding,
  };
};