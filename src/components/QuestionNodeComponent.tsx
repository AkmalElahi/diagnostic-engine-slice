import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { QuestionNode } from '../types';

interface Props {
  node: QuestionNode;
  onResponse: (value: boolean) => void;
}

export const QuestionNodeComponent: React.FC<Props> = ({ node, onResponse }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>{node.text}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.yesButton]}
          onPress={() => onResponse(true)}
        >
          <Text style={styles.buttonText}>YES</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.noButton]}
          onPress={() => onResponse(false)}
        >
          <Text style={styles.buttonText}>NO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
    minWidth: 120,
  },
  yesButton: {
    backgroundColor: '#4CAF50',
  },
  noButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
