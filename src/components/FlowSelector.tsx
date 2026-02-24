import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { FlowDefinition } from '../types';

interface FlowInfo {
  flow: FlowDefinition;
  name: string;
  description: string;
}

interface Props {
  flows: FlowInfo[];
  onSelectFlow: (flow: FlowDefinition) => void;
  onViewHistory: () => void;
  historyCount: number;
}

const isIOS = Platform.OS === 'ios'

export const FlowSelector: React.FC<Props> = ({
  flows,
  onSelectFlow,
  onViewHistory,
  historyCount,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RV Diagnostic Engine</Text>
        <Text style={styles.subtitle}>Select a diagnostic flow</Text>
      </View>

      <ScrollView style={styles.flowList}>
        {flows.map((flowInfo, index) => (
          <TouchableOpacity
            key={flowInfo.flow.flowId}
            style={styles.flowCard}
            onPress={() => onSelectFlow(flowInfo.flow)}
          >
            <Text style={styles.flowName}>{flowInfo.name}</Text>
            <Text style={styles.flowDescription}>{flowInfo.description}</Text>
            <View style={styles.flowMeta}>
              <Text style={styles.flowVersion}>v{flowInfo.flow.flowVersion}</Text>
              <Text style={styles.flowId}>{flowInfo.flow.flowId}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {historyCount > 0 && (
        <TouchableOpacity
          style={styles.historyButton}
          onPress={onViewHistory}
        >
          <Text style={styles.historyButtonText}>
            VIEW HISTORY ({historyCount})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  flowList: {
    flex: 1,
  },
  flowCard: {
    margin: 15,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  flowName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  flowDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  flowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flowVersion: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  flowId: {
    fontSize: 12,
    color: '#999',
  },
  historyButton: {
    margin: 15,
    marginBottom: isIOS ? 15 : 40,
    padding: 18,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 8,
  },
  historyButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
