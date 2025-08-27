import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  severityIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
    color: '#666',
  },
  suggestionText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  technicalDetails: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  technicalText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  actionsContainer: {
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  dismissButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});