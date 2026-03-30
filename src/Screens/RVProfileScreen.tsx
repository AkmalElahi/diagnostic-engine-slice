import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { RigIdentityService } from '../services/RigIdentityService';

interface Props {
  onComplete: () => void;
}

export const RVProfileScreen: React.FC<Props> = ({ onComplete }) => {
  const [rvName, setRvName] = useState('');
  const rig = RigIdentityService.getOrCreate();

  const handleSave = () => {
    const name = rvName.trim();
    
    if (name) {
      RigIdentityService.update({ custom_name: name });
      console.log(`[RVProfileScreen] Saved RV name: ${name}`);
    }
    
    onComplete();
  };

  const handleSkip = () => {
    console.log('[RVProfileScreen] Skipped RV profile setup');
    onComplete();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Name Your RV</Text>
        <Text style={styles.subtitle}>
          Give your RV a name or skip to use "Owner"
        </Text>

        {/* Rig ID Display */}
        <View style={styles.idContainer}>
          <Text style={styles.idLabel}>Rig ID:</Text>
          <Text style={styles.idValue}>{rig.id.substring(0, 8)}...</Text>
        </View>

        {/* RV Name Input */}
        <TextInput
          style={styles.input}
          placeholder="My RV (optional)"
          value={rvName}
          onChangeText={setRvName}
          maxLength={50}
          autoFocus
        />

        {/* Buttons */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>
            {rvName.trim() ? 'SAVE' : 'CONTINUE'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>SKIP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  idLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  idValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
  },
});