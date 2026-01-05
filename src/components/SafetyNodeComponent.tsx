import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafetyNode } from '../types';

interface Props {
  node: SafetyNode;
  onAcknowledge: () => void;
}

export const SafetyNodeComponent: React.FC<Props> = ({ node, onAcknowledge }) => {
  return (
    <View style={styles.container}>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>SAFETY WARNING</Text>
        <Text style={styles.warningText}>{node.text}</Text>
      </View>

      <TouchableOpacity
        style={styles.acknowledgeButton}
        onPress={() => onAcknowledge()}
      >
        <Text style={styles.buttonText}>I UNDERSTAND - CONTINUE</Text>
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
  warningBox: {
    backgroundColor: '#fff3cd',
    borderWidth: 3,
    borderColor: '#ff9800',
    borderRadius: 12,
    padding: 30,
    marginBottom: 30,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
    lineHeight: 26,
  },
  acknowledgeButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
