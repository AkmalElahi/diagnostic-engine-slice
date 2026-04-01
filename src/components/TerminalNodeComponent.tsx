import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { TerminalNode, SessionSummary } from '../types';

interface Props {
  node: TerminalNode | null; // null when session was stopped mid-flow
  summary: SessionSummary | null;
  onStartNew: () => void;
  onViewHistory: () => void;
}

export const TerminalNodeComponent: React.FC<Props> = ({
  node,
  summary,
  onStartNew,
  onViewHistory,
}) => {
  const isStopped = summary?.stopped ?? false;

  // Stop state check
  const isStopCondition =
    node?.result?.toLowerCase().includes('stop') ||
    node?.result?.toLowerCase().includes('do not continue');

  const resultText = node?.result ?? summary?.result ?? 'Diagnostic ended';

  // Title and styling
  let title: string;
  let boxColor: string;
  let accentColor: string;
  let displayMessage: string;

  if (isStopCondition) {
    title = 'Stop';
    boxColor = '#fff3f3';
    accentColor = '#f44336';
    displayMessage =
      'Do not continue. This condition may indicate a problem that requires attention.';
  } else if (isStopped) {
    title = 'Diagnostic Stopped';
    boxColor = '#fff8e1';
    accentColor = '#FF9800';
    displayMessage = resultText;
  } else {
    title = 'Diagnostic Complete';
    boxColor = '#e8f5e9';
    accentColor = '#4CAF50';
    displayMessage = resultText;
  }

  const duration = summary
    ? Math.round(
        (new Date(summary.completed_at).getTime() -
          new Date(summary.started_at).getTime()) /
          1000,
      )
    : null;

  const artifact = summary?.artifact;

  // Determine status for artifact display
  const getStatus = (): string => {
    if (isStopped) return 'Stopped';
    if (summary?.completed_at) return 'Complete';
    return 'Partial';
  };

  const status = getStatus();
  const statusColor = isStopped ? '#FF9800' : '#4CAF50';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View
        style={[
          styles.resultBox,
          { backgroundColor: boxColor, borderColor: accentColor },
        ]}
      >
        <Text style={[styles.completeTitle, { color: accentColor }]}>
          {title}
        </Text>
        <Text style={styles.resultText}>{displayMessage}</Text>
      </View>

      {artifact && (
        <View style={styles.artifactBox}>
          <Text style={styles.sectionTitle}>Diagnostic Summary</Text>

          <View style={styles.artifactSection}>
            <Text style={styles.artifactTitle}>{artifact.issue}</Text>
          </View>

          <View style={styles.artifactSection}>
            <Text style={styles.artifactLabel}>Status</Text>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor }]}
            >
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          <View style={styles.artifactSection}>
            <Text style={styles.artifactLabel}>Key Findings</Text>
            <Text style={styles.artifactValue}>
              {artifact.last_confirmed_state}
            </Text>
          </View>

          {artifact.recommendations && artifact.recommendations.length > 0 && (
            <View style={styles.artifactSection}>
              <Text style={styles.artifactLabel}>Recommended Next Step</Text>
              {artifact.recommendations.map((rec, i) => (
                <Text key={i} style={styles.artifactListItem}>
                  • {rec}
                </Text>
              ))}
            </View>
          )}

          {artifact.stabilization_actions &&
            artifact.stabilization_actions.length > 0 && (
              <View style={styles.artifactSection}>
                <Text style={styles.artifactLabel}>Stabilization Actions</Text>
                {artifact.stabilization_actions.map((action, i) => (
                  <Text key={i} style={styles.artifactListItem}>
                    • {action}
                  </Text>
                ))}
              </View>
            )}
        </View>
      )}

      {summary && (
        <View style={styles.metaBox}>
          <Text style={styles.sectionTitle}>Session Info</Text>
          <Text style={styles.metaItem}>ID: {summary.session_id}</Text>
          <Text style={styles.metaItem}>
            Flow: {summary.flow_id} v{summary.flow_version}
          </Text>
          <Text style={styles.metaItem}>Steps: {summary.events.length}</Text>
          {duration !== null && (
            <Text style={styles.metaItem}>Duration: {duration}s</Text>
          )}
          <Text style={styles.metaItem}>
            Rig: {summary.rig_identity.substring(0, 8)}...
          </Text>
          <Text style={styles.metaItem}>
            Creator: {summary.creator_name} ({summary.creator_type})
          </Text>
          <Text style={styles.metaItem}>
            Created: {new Date(summary.date_time).toLocaleString()}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: accentColor }]}
        onPress={onStartNew}
      >
        <Text style={styles.primaryButtonText}>START NEW DIAGNOSTIC</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: accentColor }]}
        onPress={onViewHistory}
      >
        <Text style={[styles.secondaryButtonText, { color: accentColor }]}>
          VIEW HISTORY
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  resultBox: {
    borderWidth: 3,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 17,
    textAlign: 'center',
    color: '#333',
    lineHeight: 24,
  },

  artifactBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  artifactSection: {
    marginBottom: 16,
  },
  artifactTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  artifactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  artifactValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  artifactListItem: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    paddingLeft: 4,
    marginBottom: 4,
  },

  metaBox: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metaItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },

  primaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
