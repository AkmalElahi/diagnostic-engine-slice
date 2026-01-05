import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SessionSummary } from '../types';

interface Props {
  history: SessionSummary[];
  onClose: () => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<Props> = ({ history, onClose, onClearHistory }) => {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Session History</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed sessions yet</Text>
          </View>
        ) : (
          history.map((session, index) => (
            <View key={session.session_id} style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>
                Session #{history.length - index}
              </Text>
              <Text style={styles.sessionDetail}>
                <Text style={styles.label}>Flow:</Text> {session.flow_id} v{session.flow_version}
              </Text>
              <Text style={styles.sessionDetail}>
                <Text style={styles.label}>Started:</Text> {formatDate(session.started_at)}
              </Text>
              <Text style={styles.sessionDetail}>
                <Text style={styles.label}>Completed:</Text> {formatDate(session.completed_at)}
              </Text>
              <Text style={styles.sessionDetail}>
                <Text style={styles.label}>Steps:</Text> {session.events.length}
              </Text>
              <Text style={styles.resultText}>
                <Text style={styles.label}>Result:</Text> {session.result}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {history.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClearHistory}
        >
          <Text style={styles.clearButtonText}>CLEAR HISTORY</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 22,
    color: '#666',
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  sessionCard: {
    margin: 15,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  sessionDetail: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  label: {
    fontWeight: '600',
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 4,
    color: '#333',
  },
  clearButton: {
    backgroundColor: '#f44336',
    margin: 15,
    paddingVertical: 15,
    borderRadius: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
