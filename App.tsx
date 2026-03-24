import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import {
  FlowEngine,
  FlowEngineError,
  FlowValidationError,
  ChecksumVerificationError,
} from './src/utils/FlowEngine';
import { FlowChecksumStore } from './src/utils/Flowchecksumstore';
import {
  FlowDefinition,
  MeasureNode,
  QuestionNode,
  SafetyNode,
  SessionState,
  SessionSummary,
  TerminalNode,
} from './src/types';

import { HomeScreen } from './src/Screens/HomeScreen';

import { QuestionNodeComponent } from './src/components/QuestionNodeComponent';
import { SafetyNodeComponent } from './src/components/SafetyNodeComponent';
import { MeasureNodeComponent } from './src/components/MeasureNodeComponent';
import { TerminalNodeComponent } from './src/components/TerminalNodeComponent';
import { EquipmentInventoryForm } from './src/components/EquipmentInventoryForm';

import { RVProfileForm } from './src/components/RVProfileForm';
import { HistoryView } from './src/components/HistoryView';
import { FlowSelector } from './src/components/FlowSelector';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StorageService } from './src/utils/StorageService';

import no_power_issue from './src/flows/flow_1_no_power_inside_rv_v2.json';
import water_system_issue from './src/flows/flow_2_water_system_issue_v2.json';
import propane_system_issue from './src/flows/flow_3_propane_system_issue_v2.json';
import slides_leveling_issue from './src/flows/flow_4_slides_leveling_issue_v2.json';
import { RigIdentityService } from './src/utils/RigIdentityService';
import { EquipmentService } from './src/utils/Equipmentservice';
import { MaintenanceLogScreen } from './src/Screens/Maintenancelogscreen';
import { MaintenanceService } from './src/utils/Maintenanceservice';

type ViewMode =
  | 'home'
  | 'rv-profile'
  | 'flow-select'
  | 'diagnostic'
  | 'history'
  | 'equipment'
  | 'maintenance';

const AVAILABLE_FLOWS = [
  {
    flow: no_power_issue as FlowDefinition,
    name: 'No Power Inside RV',
    description:
      'Diagnose 12V and AC power issues in your RV electrical system.',
  },
  {
    flow: water_system_issue as FlowDefinition,
    name: 'Water System Issue',
    description: 'Diagnose city water and fresh tank water system problems.',
  },
  {
    flow: propane_system_issue as FlowDefinition,
    name: 'Propane System Issue',
    description: 'Diagnose propane supply, valves, and appliance issues.',
  },
  {
    flow: slides_leveling_issue as FlowDefinition,
    name: 'Slides and Leveling Systems',
    description: 'Diagnose slide-out movement and leveling system issues.',
  },
];

const isIOS = Platform.OS === 'ios';

export default function App() {
  const [flowEngine, setFlowEngine] = useState<FlowEngine | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>('flow-select');
  const [history, setHistory] = useState<SessionSummary[]>([]);

  useEffect(() => {
    // Check if user has completed RV profile setup
    const profileCompleted = StorageService.getProfileCompleted();

    if (!profileCompleted) {
      setViewMode('rv-profile');
    } else {
      setViewMode('home');
      loadHistory();
      restoreSession();
    }
  }, []);

  // ─── Session restore ────────────────────────────────────────────────────────

  const restoreSession = async () => {
    const existing = StorageService.loadSessionState();
    if (!existing) return;

    // Only restore in-progress sessions
    if (existing.completed || existing.stopped) return;

    try {
      const matchingFlow = AVAILABLE_FLOWS.find(
        (f) => f.flow.flowId === existing.flow_id,
      );
      if (!matchingFlow) return;

      // Get checksum for verification
      const expectedChecksum = FlowChecksumStore.getChecksum(
        matchingFlow.flow.flowId,
      );

      let engine: FlowEngine;
      if (expectedChecksum) {
        engine = await FlowEngine.createWithChecksum(
          matchingFlow.flow,
          expectedChecksum,
        );
      } else {
        console.warn(
          'No checksum for flow during restore:',
          matchingFlow.flow.flowId,
        );
        engine = FlowEngine.createUnsafe(matchingFlow.flow);
      }

      setFlowEngine(engine);
      setSessionState(existing);
      setViewMode('diagnostic');
    } catch (err) {
      console.error('Failed to restore session:', err);
      StorageService.clearSessionState();
    }
  };

  // ─── History ────────────────────────────────────────────────────────────────

  const loadHistory = () => {
    setHistory(FlowEngine.getHistory());
  };

  const handleProfileComplete = () => {
    StorageService.setProfileCompleted(true);
    loadHistory();
    restoreSession();
    setViewMode('home');
  };

  // ─── Flow selection with checksum verification ──────────────────────────────

  const handleSelectFlow = async (flow: FlowDefinition) => {
    try {
      // Get expected checksum for this flow
      const expectedChecksum = FlowChecksumStore.getChecksum(flow.flowId);

      let engine: FlowEngine;

      if (expectedChecksum) {
        // Create engine with checksum verification
        engine = await FlowEngine.createWithChecksum(flow, expectedChecksum);
      } else {
        // Checksum not available - warn and create anyway
        console.warn(
          '[MISSING_CHECKSUM]',
          `No checksum found for flow ${flow.flowId}. Creating without verification.`,
        );
        engine = FlowEngine.createUnsafe(flow);
      }

      setFlowEngine(engine);
      startNewSession(engine);
    } catch (err) {
      if (err instanceof ChecksumVerificationError) {
        // Checksum verification failed - show detailed error
        Alert.alert(
          'Flow Integrity Error',
          `The selected flow has been modified and cannot be executed.\n\n` +
            `Flow: ${err.flow_id} v${err.flow_version}\n` +
            `Expected: ${err.expected_hash.substring(0, 16)}...\n` +
            `Computed: ${err.computed_hash.substring(0, 16)}...\n\n` +
            `Please contact support.`,
          [{ text: 'OK' }],
        );
      } else if (err instanceof FlowValidationError) {
        Alert.alert('Invalid Flow', err.message);
      } else if (err instanceof FlowEngineError) {
        Alert.alert('Engine Error', err.message);
      } else {
        Alert.alert('Error', 'Failed to load flow');
      }
    }
  };

  // ─── Session management ─────────────────────────────────────────────────────

  const startNewSession = (engine?: FlowEngine) => {
    try {
      const currentEngine = engine ?? flowEngine;
      if (!currentEngine) throw new Error('No flow engine available');
      const newSession = currentEngine.startSession();
      setSessionState(newSession);
      setSessionSummary(null);
      setViewMode('diagnostic');
    } catch {
      Alert.alert('Error', 'Failed to start session');
    }
  };

  // ─── Response handling ──────────────────────────────────────────────────────

  const handleResponse = async (value: string | number | boolean) => {
    if (!sessionState || !flowEngine) return;

    try {
      const updated = await flowEngine.processResponse(sessionState, value);
      setSessionState(updated);

      if (updated.completed) {
        // Load the most recent summary
        const history = StorageService.getSessionHistory();
        const latestSummary = history[history.length - 1];

        if (latestSummary) {
          setSessionSummary(latestSummary);
        } else {
          console.error('[handleResponse] Failed to load summary from storage');
        }

        loadHistory();
      }
    } catch (err) {
      if (err instanceof FlowEngineError) {
        Alert.alert('Processing Error', err.message);
      } else {
        Alert.alert('Error', 'Failed to process response');
      }
    }
  };

  // ─── STOP ───────────────────────────────────────────────────────────────────

  const handleStop = () => {
    if (!sessionState || !flowEngine) return;

    Alert.alert(
      'Stop Diagnostic',
      'This will stop the diagnostic and save a partial summary for your technician. Continue?',
      [
        { text: 'Continue Diagnostic', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => {
            try {
              const stoppedState = flowEngine.stopSession(sessionState);
              setSessionState(stoppedState);
              const history = StorageService.getSessionHistory();
              const latestSummary = history[history.length - 1];

              if (latestSummary) {
                setSessionSummary(latestSummary);
              } else {
                console.error(
                  '[handleStop] Failed to load summary from storage',
                );
              }

              loadHistory();
            } catch (err) {
              Alert.alert('Error', 'Failed to stop session');
            }
          },
        },
      ],
    );
  };

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const showHome = () => {
    setViewMode('home');
  };

  const showFlowSelect = () => {
    setViewMode('flow-select');
  };

  const showEquipment = () => {
    setViewMode('equipment');
  };

  const showMaintenance = () => {
    setViewMode('maintenance');
  };

  const closeMaintenance = () => {
    setViewMode(sessionState ? 'diagnostic' : 'home');
  };

  const closeEquipment = () => {
    setViewMode(sessionState ? 'diagnostic' : 'home');
  };

  const showHistory = () => {
    loadHistory();
    setViewMode('history');
  };

  const closeHistory = () => {
    setViewMode(sessionState ? 'diagnostic' : 'home');
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all session history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            StorageService.clearSessionHistory();
            loadHistory();
          },
        },
      ],
    );
  };

  const resetApp = () => {
    Alert.alert(
      'Reset App',
      'This will clear the current session and all history. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            StorageService.clearAll();
            setFlowEngine(null);
            setSessionState(null);
            setSessionSummary(null);
            setViewMode('flow-select');
            loadHistory();
          },
        },
      ],
    );
  };

  const backToFlowSelect = () => {
    const sessionInProgress =
      sessionState && !sessionState.completed && !sessionState.stopped;

    if (sessionInProgress) {
      Alert.alert(
        'Session In Progress',
        'Going back will abort the diagnostic. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Abort & Go Back',
            style: 'destructive',
            onPress: () => {
              if (flowEngine && sessionState) {
                try {
                  const rigIdentity = RigIdentityService.getOrCreate();

                  const summary: SessionSummary = {
                    flow_id: sessionState.flow_id,
                    flow_version: sessionState.flow_version,
                    session_id: sessionState.session_id,
                    started_at: sessionState.started_at,
                    completed_at: new Date().toISOString(),
                    events: sessionState.events,
                    terminal_node_id: sessionState.current_node_id || 'aborted',
                    result: 'Diagnostic aborted by user',
                    artifact: undefined, // No artifact for aborted sessions
                    stopped: false, // This is an abort, not a stop

                    // MS6 Contract Fields
                    creator_name: rigIdentity.custom_name || 'Owner',
                    creator_type: 'OWNER',
                    date_time: new Date().toISOString(),
                    rig_identity: rigIdentity.id,
                  };

                  // Save to history
                  StorageService.saveSessionSummary(summary);
                } catch (err) {
                  console.error('Failed to save aborted session:', err);
                }
              }

              // Clear state
              StorageService.clearSessionState();
              setFlowEngine(null);
              setSessionState(null);
              setSessionSummary(null);
              setViewMode('home');
              loadHistory();
            },
          },
        ],
      );
    } else {
      setFlowEngine(null);
      setSessionState(null);
      setSessionSummary(null);
      setViewMode('home');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (viewMode === 'home') {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <HomeScreen
            onRunDiagnostic={showFlowSelect}
            onViewEquipment={showEquipment}
            onViewHistory={showHistory}
            onViewProfile={() => setViewMode('rv-profile')}
            onViewMaintenance={showMaintenance}
            historyCount={history.length}
            equipmentCount={EquipmentService.getEquipmentCount()}
            maintenanceCount={MaintenanceService.getMaintenanceCount()}
          />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (viewMode === 'equipment') {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <EquipmentInventoryForm onBack={closeEquipment} />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (viewMode === 'maintenance') {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <MaintenanceLogScreen onBack={closeMaintenance} />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (viewMode === 'rv-profile') {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <RVProfileForm onComplete={handleProfileComplete} />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (viewMode === 'history') {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <HistoryView
            history={history}
            onClose={closeHistory}
            onClearHistory={clearHistory}
          />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (viewMode === 'flow-select') {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <FlowSelector
            flows={AVAILABLE_FLOWS}
            onSelectFlow={handleSelectFlow}
            onViewHistory={showHistory}
            historyCount={history.length}
          />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (!flowEngine || !sessionState) return null;

  const currentNode = flowEngine.getCurrentNode(sessionState);
  const sessionInProgress = !sessionState.completed && !sessionState.stopped;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={backToFlowSelect}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerText}>
            {sessionInProgress
              ? `Step ${sessionState.events.length + 1}`
              : sessionState.stopped
                ? 'Stopped'
                : 'Complete'}
          </Text>
          <View style={styles.headerActions}>
            {sessionInProgress && (
              <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={resetApp}>
              <Text style={styles.resetLink}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {currentNode.type === 'QUESTION' && (
            <QuestionNodeComponent
              node={currentNode as unknown as QuestionNode}
              onResponse={handleResponse}
            />
          )}

          {currentNode.type === 'SAFETY' && (
            <SafetyNodeComponent
              node={currentNode as unknown as SafetyNode}
              onAcknowledge={() => handleResponse(true)}
            />
          )}

          {currentNode.type === 'MEASURE' && (
            <MeasureNodeComponent
              node={currentNode as unknown as MeasureNode}
              onSubmit={handleResponse}
            />
          )}

          {(currentNode.type === 'TERMINAL' ||
            sessionState.completed ||
            sessionState.stopped) && (
            <TerminalNodeComponent
              node={
                currentNode.type === 'TERMINAL'
                  ? (currentNode as unknown as TerminalNode)
                  : null
              }
              summary={sessionSummary}
              onStartNew={() => startNewSession()}
              onViewHistory={showHistory}
            />
          )}
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: isIOS ? 0 : 30,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stopButton: {
    backgroundColor: '#fff3f3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  stopButtonText: {
    fontSize: 13,
    color: '#f44336',
    fontWeight: '600',
  },
  resetLink: {
    fontSize: 14,
    color: '#999',
  },
  content: {
    flex: 1,
  },
});
