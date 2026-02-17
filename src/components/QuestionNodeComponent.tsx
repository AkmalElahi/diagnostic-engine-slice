import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { QuestionNode } from '../types';

interface Props {
  node: QuestionNode;
  onResponse: (value: string) => void;
}

// Palette cycles through these for 3+ answer keys
const ANSWER_COLORS = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4'];

// Special-case: yes/no pair gets the familiar green/red treatment
const YES_NO_KEYS = new Set(['yes', 'no']);

function getButtonColor(key: string, index: number, totalKeys: number): string {
  const isYesNo = totalKeys === 2 &&
    YES_NO_KEYS.has(key.toLowerCase());

  if (isYesNo) {
    return key.toLowerCase() === 'yes' ? '#4CAF50' : '#f44336';
  }
  return ANSWER_COLORS[index % ANSWER_COLORS.length];
}

function formatLabel(key: string): string {
  // Convert snake_case to Title Case for display
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const QuestionNodeComponent: React.FC<Props> = ({ node, onResponse }) => {
  const answerEntries = Object.entries(node.answers);
  const isVerticalLayout = answerEntries.length > 2;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.questionText}>{node.text}</Text>

      <View style={isVerticalLayout ? styles.buttonColumnContainer : styles.buttonRowContainer}>
        {answerEntries.map(([key], index) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.button,
              isVerticalLayout ? styles.buttonFull : styles.buttonHalf,
              { backgroundColor: getButtonColor(key, index, answerEntries.length) },
            ]}
            onPress={() => onResponse(key)}
          >
            <Text style={styles.buttonText}>{formatLabel(key)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  questionText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#333',
    lineHeight: 30,
  },
  buttonRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  buttonColumnContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonHalf: {
    minWidth: 120,
    flex: 1,
  },
  buttonFull: {
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
