import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { TerminalNode, SessionSummary } from '../types';

interface Props {
  node: TerminalNode | null;  // null when session was stopped mid-flow
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

  const resultText = node?.result ?? summary?.result ?? 'Diagnostic ended';
  const title      = isStopped ? 'Diagnostic Stopped' : 'Diagnostic Complete';
  const boxColor   = isStopped ? '#fff8e1' : '#e8f5e9';
  const accentColor = isStopped ? '#FF9800' : '#4CAF50';

  const duration = summary
    ? Math.round(
        (new Date(summary.completed_at).getTime() -
          new Date(summary.started_at).getTime()) / 1000
      )
    : null;

  const artifact = summary?.artifact;

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Result box */}
      <View style={[styles.resultBox, { backgroundColor: boxColor, borderColor: accentColor }]}>
        <Text style={[styles.completeTitle, { color: accentColor }]}>{title}</Text>
        <Text style={styles.resultText}>{resultText}</Text>
      </View>

      {/* Artifact key fields */}
      {artifact && (
        <View style={styles.artifactBox}>
          <Text style={styles.sectionTitle}>Diagnostic Summary</Text>

          <View style={styles.artifactRow}>
            <Text style={styles.artifactLabel}>Stop Reason</Text>
            <Text style={styles.artifactValue}>{artifact.stop_reason}</Text>
          </View>

          <View style={styles.artifactRow}>
            <Text style={styles.artifactLabel}>Last Confirmed State</Text>
            <Text style={styles.artifactValue}>{artifact.last_confirmed_state}</Text>
          </View>

          {Array.isArray(artifact.stabilization_actions) &&
            artifact.stabilization_actions.length > 0 && (
              <View style={styles.artifactRow}>
                <Text style={styles.artifactLabel}>Stabilization Actions</Text>
                {artifact.stabilization_actions.map((action, i) => (
                  <Text key={i} style={styles.artifactListItem}>• {action}</Text>
                ))}
              </View>
            )}

          {Array.isArray(artifact.recommendations) &&
            artifact.recommendations.length > 0 && (
              <View style={styles.artifactRow}>
                <Text style={styles.artifactLabel}>Recommendations</Text>
                {artifact.recommendations.map((rec, i) => (
                  <Text key={i} style={styles.artifactListItem}>• {rec}</Text>
                ))}
              </View>
            )}
        </View>
      )}

      {/* Session meta */}
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
    marginBottom: 16,
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  artifactRow: {
    marginBottom: 10,
  },
  artifactLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  artifactValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  artifactListItem: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    paddingLeft: 4,
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
