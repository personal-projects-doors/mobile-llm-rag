import React from 'react';
import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import {Dialog} from '../Dialog/Dialog';
import {useTheme} from '../../hooks/useTheme';
import {RAGError, RAGRecoveryAction} from '../../services/rag/types';
import {ragErrorHandler} from '../../services/rag';
import {styles} from './styles';

export interface RAGErrorDialogProps {
  visible: boolean;
  error?: RAGError;
  onDismiss: () => void;
  onRecoveryAction?: (action: RAGRecoveryAction) => void;
}

export const RAGErrorDialog: React.FC<RAGErrorDialogProps> = ({
  visible,
  error,
  onDismiss,
  onRecoveryAction,
}) => {
  const theme = useTheme();

  if (!error) {
    return null;
  }

  const errorMessage = ragErrorHandler.createUserErrorMessage(error);

  const handleRecoveryAction = (action: RAGRecoveryAction) => {
    if (onRecoveryAction) {
      onRecoveryAction(action);
    }
    onDismiss();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return theme.colors.error;
      case 'high':
        return theme.colors.warning;
      case 'medium':
        return theme.colors.primary;
      case 'low':
        return theme.colors.text;
      default:
        return theme.colors.text;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return 'ℹ️';
      case 'low':
        return '💡';
      default:
        return 'ℹ️';
    }
  };

  return (
    <Dialog
      visible={visible}
      onDismiss={onDismiss}
      title={
        <View style={styles.titleContainer}>
          <Text style={styles.severityIcon}>
            {getSeverityIcon(error.severity)}
          </Text>
          <Text style={[styles.title, {color: getSeverityColor(error.severity)}]}>
            {errorMessage.title}
          </Text>
        </View>
      }
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Error Message */}
        <View style={styles.section}>
          <Text style={[styles.message, {color: theme.colors.text}]}>
            {errorMessage.message}
          </Text>
        </View>

        {/* Error Details */}
        {error.isRecoverable && (
          <View style={styles.section}>
            <View style={[styles.badge, {backgroundColor: theme.colors.primary + '20'}]}>
              <Text style={[styles.badgeText, {color: theme.colors.primary}]}>
                Recoverable
              </Text>
            </View>
          </View>
        )}

        {error.isTransient && (
          <View style={styles.section}>
            <View style={[styles.badge, {backgroundColor: theme.colors.warning + '20'}]}>
              <Text style={[styles.badgeText, {color: theme.colors.warning}]}>
                Temporary Issue
              </Text>
            </View>
          </View>
        )}

        {/* Suggestions */}
        {errorMessage.suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Suggestions:
            </Text>
            {errorMessage.suggestions.map((suggestion, index) => (
              <View key={index} style={styles.suggestionItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.suggestionText, {color: theme.colors.text}]}>
                  {suggestion}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Technical Details (for debugging) */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.colors.text}]}>
              Technical Details:
            </Text>
            <View style={[styles.technicalDetails, {backgroundColor: theme.colors.surface}]}>
              <Text style={[styles.technicalText, {color: theme.colors.text}]}>
                {error.getTechnicalDetails()}
              </Text>
              <Text style={[styles.technicalText, {color: theme.colors.text}]}>
                Category: {error.category}
              </Text>
              <Text style={[styles.technicalText, {color: theme.colors.text}]}>
                Timestamp: {error.timestamp.toLocaleString()}
              </Text>
              {error.context.operation && (
                <Text style={[styles.technicalText, {color: theme.colors.text}]}>
                  Operation: {error.context.operation}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Recovery Actions */}
      <View style={styles.actionsContainer}>
        {errorMessage.actions
          .sort((a, b) => {
            const priorityOrder = {high: 3, medium: 2, low: 1};
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          })
          .map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                {
                  backgroundColor: action.priority === 'high' 
                    ? theme.colors.primary 
                    : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => handleRecoveryAction(action)}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  {
                    color: action.priority === 'high' 
                      ? theme.colors.onPrimary 
                      : theme.colors.text,
                  },
                ]}
              >
                {action.label}
              </Text>
              {action.description && (
                <Text
                  style={[
                    styles.actionDescription,
                    {
                      color: action.priority === 'high' 
                        ? theme.colors.onPrimary + '80' 
                        : theme.colors.text + '80',
                    },
                  ]}
                >
                  {action.description}
                </Text>
              )}
            </TouchableOpacity>
          ))}

        {/* Dismiss Button */}
        <TouchableOpacity
          style={[styles.dismissButton, {borderColor: theme.colors.border}]}
          onPress={onDismiss}
        >
          <Text style={[styles.dismissButtonText, {color: theme.colors.text}]}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};