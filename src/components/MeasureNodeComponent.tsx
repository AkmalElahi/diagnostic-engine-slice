import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MeasureNode } from '../types';

interface Props {
  node: MeasureNode;
  onSubmit: (value: number) => void;
}

export const MeasureNodeComponent: React.FC<Props> = ({ node, onSubmit }) => {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = () => {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }

    setError('');
    onSubmit(numValue);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instructionText}>{node.text}</Text>
      
      <View style={styles.rangeInfo}>
        <Text style={styles.rangeText}>
          Valid range: {node.min} - {node.max}
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Enter measurement"
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError('');
        }}
        keyboardType="numeric"
        autoFocus
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>SUBMIT MEASUREMENT</Text>
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
  instructionText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  rangeInfo: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  rangeText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#1976d2',
    fontWeight: '600',
  },
  input: {
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 8,
    padding: 15,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: 'white',
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#2196F3',
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
