import React, {useState} from 'react';
import {View, ScrollView, TouchableOpacity} from 'react-native';
import {Text, Button, Card, IconButton, Divider} from 'react-native-paper';
import {observer} from 'mobx-react';

import {Sheet} from '../Sheet';
import {useTheme} from '../../hooks';
import {createStyles} from './styles';

export interface RAGOnboardingProps {
  visible: boolean;
  onDismiss: () => void;
  onGetStarted: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  details: string[];
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Upload Documents',
    description: 'Add PDF documents to create your knowledge base',
    icon: 'file-document-plus',
    details: [
      'Import PDF files from your device',
      'Documents are processed locally for privacy',
      'Supports medical, academic, and technical PDFs',
    ],
  },
  {
    title: 'AI Processing',
    description: 'Your documents are analyzed and indexed on-device',
    icon: 'brain',
    details: [
      'Text is extracted and chunked intelligently',
      'Embeddings generated using medgemma model',
      'All processing happens locally - no data leaves your device',
    ],
  },
  {
    title: 'Enhanced Conversations',
    description: 'Chat with AI that can reference your documents',
    icon: 'chat-processing',
    details: [
      'AI responses include relevant document content',
      'Source citations show where information comes from',
      'Tap citations to view original document sections',
    ],
  },
];

export const RAGOnboarding: React.FC<RAGOnboardingProps> = observer(
  ({visible, onDismiss, onGetStarted}) => {
    const theme = useTheme();
    const styles = createStyles({theme});
    const [currentStep, setCurrentStep] = useState(0);
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    const handleNext = () => {
      if (currentStep < onboardingSteps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onGetStarted();
      }
    };

    const handlePrevious = () => {
      if (currentStep > 0) {
        setCurrentStep(currentStep - 1);
      }
    };

    const handleStepPress = (stepIndex: number) => {
      setExpandedStep(expandedStep === stepIndex ? null : stepIndex);
    };

    const currentStepData = onboardingSteps[currentStep];

    return (
      <Sheet isVisible={visible} onDismiss={onDismiss} displayFullHeight>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.title}>
              Welcome to RAG
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Retrieval-Augmented Generation lets you chat with AI using your own documents
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              {onboardingSteps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentStep && styles.progressDotActive,
                    index < currentStep && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>

            {/* Current Step */}
            <Card style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <IconButton
                  icon={currentStepData.icon}
                  size={32}
                  iconColor={theme.colors.primary}
                  style={styles.stepIcon}
                />
                <View style={styles.stepTitleContainer}>
                  <Text variant="titleLarge" style={styles.stepTitle}>
                    {currentStepData.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.stepDescription}>
                    {currentStepData.description}
                  </Text>
                </View>
              </View>

              <View style={styles.stepDetails}>
                {currentStepData.details.map((detail, index) => (
                  <View key={index} style={styles.detailItem}>
                    <IconButton
                      icon="check-circle"
                      size={16}
                      iconColor={theme.colors.primary}
                      style={styles.detailIcon}
                    />
                    <Text variant="bodyMedium" style={styles.detailText}>
                      {detail}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* All Steps Overview */}
            <View style={styles.overviewSection}>
              <Text variant="titleMedium" style={styles.overviewTitle}>
                How RAG Works
              </Text>
              {onboardingSteps.map((step, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.overviewStep,
                    index === currentStep && styles.overviewStepActive,
                  ]}
                  onPress={() => handleStepPress(index)}>
                  <View style={styles.overviewStepHeader}>
                    <IconButton
                      icon={step.icon}
                      size={20}
                      iconColor={
                        index === currentStep
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                      style={styles.overviewStepIcon}
                    />
                    <View style={styles.overviewStepContent}>
                      <Text
                        variant="bodyMedium"
                        style={[
                          styles.overviewStepTitle,
                          index === currentStep && styles.overviewStepTitleActive,
                        ]}>
                        {step.title}
                      </Text>
                      <Text variant="bodySmall" style={styles.overviewStepDesc}>
                        {step.description}
                      </Text>
                    </View>
                    <IconButton
                      icon={expandedStep === index ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      iconColor={theme.colors.onSurfaceVariant}
                    />
                  </View>

                  {expandedStep === index && (
                    <View style={styles.expandedDetails}>
                      <Divider style={styles.expandedDivider} />
                      {step.details.map((detail, detailIndex) => (
                        <Text
                          key={detailIndex}
                          variant="bodySmall"
                          style={styles.expandedDetail}>
                          • {detail}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Privacy Notice */}
            <Card style={styles.privacyCard}>
              <View style={styles.privacyHeader}>
                <IconButton
                  icon="shield-check"
                  size={24}
                  iconColor={theme.colors.primary}
                />
                <Text variant="titleMedium" style={styles.privacyTitle}>
                  Your Privacy is Protected
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.privacyText}>
                All document processing happens entirely on your device. Your documents and 
                conversations never leave your phone, ensuring complete privacy and security.
              </Text>
            </Card>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.navigationButtons}>
              <Button
                mode="outlined"
                onPress={handlePrevious}
                disabled={currentStep === 0}
                style={styles.navButton}>
                Previous
              </Button>
              <Button
                mode="contained"
                onPress={handleNext}
                style={styles.navButton}>
                {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </View>
            <Button
              mode="text"
              onPress={onDismiss}
              style={styles.skipButton}>
              Skip Tutorial
            </Button>
          </View>
        </View>
      </Sheet>
    );
  }
);