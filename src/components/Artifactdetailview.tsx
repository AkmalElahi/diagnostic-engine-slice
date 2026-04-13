import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SessionSummary } from '../types';

interface Props {
  summary: SessionSummary;
  onClose: () => void;
}

/**
 * Artifact Detail View
 * 
 * Displays complete artifact in standardized format:
 * 1. Title
 * 2. Status
 * 3. Key Findings
 * 4. Recommended Next Step
 * 
 * Then shows step-by-step execution trace.
 */
export const ArtifactDetailView: React.FC<Props> = ({ summary, onClose }) => {
  const artifact = summary.artifact;

  // Determine status
  const getStatus = (): string => {
    if (summary.stopped) return 'Stopped';
    if (summary.completed_at) return 'Complete';
    return 'Partial';
  };

  const status = getStatus();
  const statusColor = summary.stopped ? '#FF9800' : summary.completed_at ? '#4CAF50' : '#2196F3';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artifact Detail</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {artifact && (
          <View style={styles.artifactSection}>
            <View style={styles.section}>
              <Text style={styles.artifactTitle}>{artifact.issue}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{status}</Text>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key Findings</Text>
              <Text style={styles.sectionValue}>
                {artifact.primary_finding}
              </Text>
            </View>
            <View style={styles.artifactSection}>
              <Text style={styles.sectionLabel}>Explanation</Text>
              <Text style={styles.sectionValue}>{artifact.explanation}</Text>
            </View>
            {artifact.recommendations &&
              artifact.recommendations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Recommended Next Step</Text>
                  {artifact.recommendations.map((rec, index) => (
                    <Text key={index} style={styles.bulletItem}>
                      • {rec}
                    </Text>
                  ))}
                </View>
              )}
            {artifact.stabilization_actions &&
              artifact.stabilization_actions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Stabilization Actions</Text>
                  {artifact.stabilization_actions.map((action, index) => (
                    <Text key={index} style={styles.bulletItem}>
                      • {action}
                    </Text>
                  ))}
                </View>
              )}
          </View>
        )}
        <View style={styles.traceSection}>
          <Text style={styles.traceTitle}>Step-by-Step Trace</Text>

          {summary.events.map((event, index) => {
            return (
              <View key={index} style={styles.traceStep}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepNumber}>Step {index + 1}</Text>
                  <Text style={styles.stepType}>{event.type}</Text>
                </View>
                <View style={styles.stepContent}>
                  <View style={styles.stepRow}>
                    <Text style={styles.stepLabel}>Step Name:</Text>
                    <Text style={styles.stepValue}>
                      {event.node_text ||
                        String(event.node_id)
                          ?.replace(/_/g, ' ')
                          ?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.stepRow}>
                    <Text style={styles.stepLabel}>User Input:</Text>
                    <Text
                      style={{
                        ...styles.stepValue,
                        textTransform: 'capitalize',
                      }}
                    >
                      {typeof event.value === 'boolean'
                        ? event.value
                          ? 'Yes'
                          : 'No'
                        : String(event.value).replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <View style={styles.stepRow}>
                    <Text style={styles.stepLabel}>System Result:</Text>
                    <Text
                      style={{
                        ...styles.stepValue,
                        textTransform: 'capitalize',
                      }}
                    >
                      {String(event.result_text)?.replace(/_/g, ' ') ||
                        (artifact
                          ? artifact.last_confirmed_state
                          : 'Processed')}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.metadataSection}>
          <Text style={styles.metadataTitle}>Session Information</Text>
          <View style={styles.metadataGrid}>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Session ID</Text>
              <Text style={styles.metadataValue}>{summary.session_id}</Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Flow</Text>
              <Text style={styles.metadataValue}>
                {summary.flow_id} v{summary.flow_version}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Creator</Text>
              <Text style={styles.metadataValue}>
                {summary.creator_name} ({summary.creator_type})
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Rig ID</Text>
              <Text style={styles.metadataValue}>
                {summary.rig_identity.substring(0, 8)}...
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Started</Text>
              <Text style={styles.metadataValue}>
                {new Date(summary.started_at).toLocaleString()}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Completed</Text>
              <Text style={styles.metadataValue}>
                {new Date(summary.completed_at).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },

  // Artifact Section
  artifactSection: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  artifactTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionValue: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bulletItem: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    paddingLeft: 8,
    marginBottom: 4,
  },

  // Trace Section
  traceSection: {
    marginBottom: 24,
  },
  traceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  traceStep: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  stepType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  stepContent: {
    gap: 8,
  },
  stepRow: {
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 2,
  },
  stepValue: {
    fontSize: 14,
    color: '#333',
  },

  // Metadata Section
  metadataSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  metadataGrid: {
    gap: 12,
  },
  metadataItem: {
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: 14,
    color: '#333',
  },
});
