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
import { FlowEngine, FlowEngineError } from './src/utils/FlowEngine';
import { FlowDefinition, MeasureNode, QuestionNode, SafetyNode, SessionState, SessionSummary, TerminalNode } from './src/types';
import { QuestionNodeComponent } from './src/components/QuestionNodeComponent';
import { SafetyNodeComponent } from './src/components/SafetyNodeComponent';
import { MeasureNodeComponent } from './src/components/MeasureNodeComponent';
import { TerminalNodeComponent } from './src/components/TerminalNodeComponent';
import { HistoryView } from './src/components/HistoryView';
import { FlowSelector } from './src/components/FlowSelector';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StorageService } from './src/utils/StorageService';
import { FlowValidationError } from './src/utils/FlowValidator';

import no_power_issue from './src/flows/flow_1_no_power_inside_rv_v2.json';
import water_system_issue from './src/flows/flow_2_water_system_issue_v2.json';
import propane_system_issue from './src/flows/flow_3_propane_system_issue_v2.json';
import slides_leveling_issue from './src/flows/flow_4_slides_leveling_issue_v2.json';

type ViewMode = 'flow-select' | 'diagnostic' | 'history';

const AVAILABLE_FLOWS = [
  {
    flow: no_power_issue as FlowDefinition,
    name: 'No Power Inside RV',
    description: 'Diagnose 12V and AC power issues in your RV electrical system.',
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
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('flow-select');
  const [history, setHistory] = useState<SessionSummary[]>([]);

  useEffect(() => {
    loadHistory();
    restoreSession();
  }, []);

  // ─── Session restore ────────────────────────────────────────────────────────

  const restoreSession = () => {
    const existing = StorageService.loadSessionState();
    if (!existing) return;

    // Only restore in-progress sessions
    if (existing.completed || existing.stopped) return;

    try {
      const matchingFlow = AVAILABLE_FLOWS.find(
        f => f.flow.flowId === existing.flow_id
      );
      if (!matchingFlow) return;

      const engine = new FlowEngine(matchingFlow.flow);
      setFlowEngine(engine);
      setSessionState(existing);
      setViewMode('diagnostic');
    } catch {
      StorageService.clearSessionState();
    }
  };

  // ─── History ────────────────────────────────────────────────────────────────

  const loadHistory = () => {
    setHistory(FlowEngine.getHistory());
  };

  // ─── Flow selection ─────────────────────────────────────────────────────────

  const handleSelectFlow = (flow: FlowDefinition) => {
    try {
      const engine = new FlowEngine(flow);
      setFlowEngine(engine);
      startNewSession(engine);
    } catch (err) {
      if (err instanceof FlowValidationError) {
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

  const handleResponse = (value: string | number | boolean) => {
    if (!sessionState || !flowEngine) return;

    try {
      const updated = flowEngine.processResponse(sessionState, value);
      setSessionState(updated);

      if (updated.completed) {
        // Build summary from completed state — artifact is already on the state
        const summary: SessionSummary = {
          flow_id:          updated.flow_id,
          flow_version:     updated.flow_version,
          session_id:       updated.session_id,
          started_at:       updated.started_at,
          completed_at:     updated.completed_at!,
          events:           updated.events,
          terminal_node_id: updated.terminal_node_id!,
          result:           updated.result!,
          artifact:         updated.artifact,
          stopped:          false,
        };
        setSessionSummary(summary);
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

              const summary: SessionSummary = {
                flow_id:          stoppedState.flow_id,
                flow_version:     stoppedState.flow_version,
                session_id:       stoppedState.session_id,
                started_at:       stoppedState.started_at,
                completed_at:     stoppedState.stopped_at!,
                events:           stoppedState.events,
                terminal_node_id: stoppedState.stop_node_id!,
                result:           `Diagnostic stopped at: ${stoppedState.stop_node_id}`,
                artifact:         stoppedState.partial_artifact,
                stopped:          true,
              };
              setSessionSummary(summary);
              loadHistory();
            } catch (err) {
              Alert.alert('Error', 'Failed to stop session');
            }
          },
        },
      ]
    );
  };

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const showHistory = () => {
    loadHistory();
    setViewMode('history');
  };

  const closeHistory = () => {
    setViewMode(sessionState ? 'diagnostic' : 'flow-select');
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
      ]
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
      ]
    );
  };

  const backToFlowSelect = () => {
    const sessionInProgress =
      sessionState && !sessionState.completed && !sessionState.stopped;

    if (sessionInProgress) {
      Alert.alert(
        'Session In Progress',
        'Going back will stop the diagnostic and save a partial summary. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop & Go Back',
            style: 'destructive',
            onPress: () => {
              // Save partial artifact before leaving
              if (flowEngine && sessionState) {
                try {
                  flowEngine.stopSession(sessionState);
                } catch {}
              }
              setFlowEngine(null);
              setSessionState(null);
              setSessionSummary(null);
              setViewMode('flow-select');
              loadHistory();
            },
          },
        ]
      );
    } else {
      setFlowEngine(null);
      setSessionState(null);
      setSessionSummary(null);
      setViewMode('flow-select');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
              node={currentNode.type === 'TERMINAL' ? currentNode as unknown as TerminalNode : null}
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