import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SessionSummary } from '../types';
import { StorageService } from '../services/StorageService';
import { ArtifactDetailView } from '../components/Artifactdetailview';

interface Props {
  onBack: () => void;
}

/**
 * Artifact History Screen
 * 
 * Lists all generated artifacts (completed + stopped sessions).
 * Tap an artifact to view full details.
 */
export const ArtifactHistoryScreen: React.FC<Props> = ({ onBack }) => {
  const [artifacts, setArtifacts] = useState<SessionSummary[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<SessionSummary | null>(null);

  useEffect(() => {
    loadArtifacts();
  }, []);

  const loadArtifacts = () => {
    const history = StorageService.getSessionHistory();
    
    // Filter: only sessions with artifacts
    const withArtifacts = history.filter(session => session.artifact !== undefined);
    
    // Sort: newest first
    withArtifacts.sort((a, b) => 
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
    
    setArtifacts(withArtifacts);
  };

  const handleArtifactPress = (artifact: SessionSummary) => {
    setSelectedArtifact(artifact);
  };

  const handleCloseDetail = () => {
    setSelectedArtifact(null);
  };

  // Show detail view if artifact selected
  if (selectedArtifact) {
    return <ArtifactDetailView summary={selectedArtifact} onClose={handleCloseDetail} />;
  }

  // Determine status
  const getStatus = (session: SessionSummary): string => {
    if (session.stopped) return 'Stopped';
    if (session.completed_at) return 'Complete';
    return 'Partial';
  };

  const getStatusColor = (session: SessionSummary): string => {
    if (session.stopped) return '#FF9800';
    if (session.completed_at) return '#4CAF50';
    return '#2196F3';
  };

  // Get flow display name
  const getFlowName = (flowId: string): string => {
    const flowNames: Record<string, string> = {
      'flow_1_no_power_inside_rv_v2': 'No Power Inside RV',
      'flow_2_water_system_issue_v2': 'Water System Issue',
      'flow_3_propane_system_issue_v2': 'Propane System Issue',
      'flow_4_slides_leveling_issue_v2': 'Slides & Leveling',
    };
    return flowNames[flowId] || flowId;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artifact History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Artifact List */}
      {artifacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No artifacts yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a diagnostic to generate an artifact
          </Text>
        </View>
      ) : (
        <FlatList
          data={artifacts}
          keyExtractor={(item) => item.session_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const status = getStatus(item);
            const statusColor = getStatusColor(item);
            const flowName = getFlowName(item.flow_id);

            return (
              <TouchableOpacity
                style={styles.artifactCard}
                onPress={() => handleArtifactPress(item)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {item.artifact?.issue || flowName}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>

                <Text style={styles.cardFlow}>{flowName}</Text>

                <Text style={styles.cardDate}>
                  {new Date(item.completed_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>

                {item.artifact && (
                  <Text style={styles.cardPreview} numberOfLines={2}>
                    {item.artifact.last_confirmed_state}
                  </Text>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.cardMeta}>
                    {item.events.length} steps
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 50,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },

  // Artifact Card
  artifactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardFlow: {
    fontSize: 13,
    color: '#2196F3',
    marginBottom: 4,
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  cardPreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  cardMeta: {
    fontSize: 12,
    color: '#999',
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
  },
});