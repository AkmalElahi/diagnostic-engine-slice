import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TerminalNode, SessionSummary } from '../types';

interface Props {
  node: TerminalNode;
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
  return (
    <View style={styles.container}>
      <View style={styles.resultBox}>
        <Text style={styles.completeTitle}>Diagnostic Complete</Text>
        <Text style={styles.resultText}>{node.result}</Text>
      </View>

      {summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Session Summary</Text>
          <Text style={styles.summaryItem}>Session ID: {summary.session_id}</Text>
          <Text style={styles.summaryItem}>Flow: {summary.flow_id} v{summary.flow_version}</Text>
          <Text style={styles.summaryItem}>Steps: {summary.events.length}</Text>
          <Text style={styles.summaryItem}>
            Duration: {Math.round((new Date(summary.completed_at).getTime() - 
                       new Date(summary.started_at).getTime()) / 1000)}s
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onStartNew}
      >
        <Text style={styles.buttonText}>START NEW DIAGNOSTIC</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onViewHistory}
      >
        <Text style={styles.secondaryButtonText}>VIEW HISTORY</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  resultBox: {
    backgroundColor: '#e8f5e9',
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  completeIcon: {
    fontSize: 60,
    color: '#4CAF50',
    marginBottom: 10,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
  },
  resultText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
    lineHeight: 26,
  },
  summaryBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  summaryItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
