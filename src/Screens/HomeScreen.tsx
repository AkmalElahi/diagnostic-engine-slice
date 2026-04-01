import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface Props {
  onRunDiagnostic: () => void;
  onViewEquipment: () => void;
  onViewHistory: () => void;
  onViewProfile: () => void;
  onViewMaintenance: () => void;
  onViewArtifacts: () => void;
  historyCount: number;
  equipmentCount: number;
  maintenanceCount: number;
  artifactCount: number;
}

export const HomeScreen: React.FC<Props> = ({
  onRunDiagnostic,
  onViewEquipment,
  onViewHistory,
  onViewProfile,
  onViewMaintenance,
  onViewArtifacts,
  historyCount,
  equipmentCount,
  maintenanceCount,
  artifactCount,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>RV Tech Vault</Text>
          <Text style={styles.subtitle}>Diagnostic Tool</Text>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity
            style={[styles.menuItem, styles.primaryButton]}
            onPress={onRunDiagnostic}
          >
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitlePrimary}>Run Diagnostic</Text>
              <Text style={styles.menuDescriptionPrimary}>
                Troubleshoot RV issues
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={onViewEquipment}>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Equipment Inventory</Text>
              <Text style={styles.menuDescription}>
                {equipmentCount} items tracked
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={onViewMaintenance}>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Maintenance Log</Text>
              <Text style={styles.menuDescription}>
                {maintenanceCount} entries
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={onViewArtifacts}>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Artifact History</Text>
              <Text style={styles.menuDescription}>
                {artifactCount} artifacts
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={onViewHistory}>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Diagnostic History</Text>
              <Text style={styles.menuDescription}>
                {historyCount} sessions
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={onViewProfile}>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>RV Profile</Text>
              <Text style={styles.menuDescription}>
                View and edit RV details
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  menu: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  menuIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  menuTitlePrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 14,
    color: '#666',
  },
  menuDescriptionPrimary: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    fontWeight: '300',
  },
});
