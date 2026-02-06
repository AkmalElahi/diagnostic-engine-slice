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
import { FlowDefinition, SessionState, SessionSummary } from './src/types';
import { QuestionNodeComponent } from './src/components/QuestionNodeComponent';
import { SafetyNodeComponent } from './src/components/SafetyNodeComponent';
import { MeasureNodeComponent } from './src/components/MeasureNodeComponent';
import { TerminalNodeComponent } from './src/components/TerminalNodeComponent';
import { HistoryView } from './src/components/HistoryView';
import { FlowSelector } from './src/components/FlowSelector';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StorageService } from './src/utils/StorageService';
import { FlowValidationError } from './src/utils/FlowValidator';

import no_power_issue from './src/flows/flow_1_no_power.json';
import { demonstrateDeterminism } from './src/tests/determinism-demo';
import { demonstrateValidation } from './src/tests/validation-demo';

type ViewMode = 'flow-select' | 'diagnostic' | 'history';

const AVAILABLE_FLOWS = [
  {
    flow: no_power_issue as FlowDefinition,
    name: '12V Power Diagnostic',
    description: 'Diagnose 12V power issues in RV electrical system',
  },
];

const isIOS = Platform.OS === 'ios';

export default function App() {
  const [flowEngine, setFlowEngine] = useState<FlowEngine | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(
    null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('flow-select');
  const [history, setHistory] = useState<SessionSummary[]>([]);

  // useEffect(() => {
  //   // Run once on app start
  //   setTimeout(() => {
  //     demonstrateDeterminism();
  //     demonstrateValidation();
  //   }, 1000);
  // }, []);

  useEffect(() => {
    loadHistory();

    const existingSession = StorageService.loadSessionState();
    if (existingSession) {
      try {
        const matchingFlow = AVAILABLE_FLOWS.find(
          (f) => f.flow.flow_id === existingSession.flow_id
        );

        if (matchingFlow) {
          const engine = new FlowEngine(matchingFlow.flow);
          setFlowEngine(engine);
          setSessionState(existingSession);
          setViewMode('diagnostic');

          if (existingSession.completed) {
            const summary: SessionSummary = {
              flow_id: existingSession.flow_id,
              flow_version: existingSession.flow_version,
              session_id: existingSession.session_id,
              started_at: existingSession.started_at,
              completed_at: existingSession.completed_at!,
              events: existingSession.events,
              terminal_node_id: existingSession.terminal_node_id!,
              result: existingSession.result!,
            };
            setSessionSummary(summary);
          }
        }
      } catch (err) {
        StorageService.clearSessionState();
      }
    }
  }, []);

  const loadHistory = () => {
    const loadedHistory = FlowEngine.getHistory();
    setHistory(loadedHistory);
  };

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

  const startNewSession = (engine?: FlowEngine) => {
    try {
      const currentEngine = engine || flowEngine;
      if (!currentEngine) {
        throw new Error('No flow engine available');
      }

      const newSession = currentEngine.startSession();
      setSessionState(newSession);
      setSessionSummary(null);
      setViewMode('diagnostic');
    } catch (err) {
      Alert.alert('Error', 'Failed to start session');
    }
  };

  const handleResponse = (value: string | number | boolean) => {
    if (!sessionState || !flowEngine) return;

    try {
      const updatedSession = flowEngine.processResponse(sessionState, value);
      setSessionState(updatedSession);

      if (updatedSession.completed) {
        const summary: SessionSummary = {
          flow_id: updatedSession.flow_id,
          flow_version: updatedSession.flow_version,
          session_id: updatedSession.session_id,
          started_at: updatedSession.started_at,
          completed_at: updatedSession.completed_at!,
          events: updatedSession.events,
          terminal_node_id: updatedSession.terminal_node_id!,
          result: updatedSession.result!,
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

  const showHistory = () => {
    loadHistory();
    setViewMode('history');
  };

  const closeHistory = () => {
    if (sessionState) {
      setViewMode('diagnostic');
    } else {
      setViewMode('flow-select');
    }
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
    if (sessionState && !sessionState.completed) {
      Alert.alert(
        'Session In Progress',
        'You have an active session. Going back will abandon it. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Abandon',
            style: 'destructive',
            onPress: () => {
              StorageService.clearSessionState();
              setFlowEngine(null);
              setSessionState(null);
              setSessionSummary(null);
              setViewMode('flow-select');
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

  // History view
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

  // Flow selection view
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

  // Diagnostic view
  if (!flowEngine || !sessionState) {
    return null;
  }

  const currentNode = flowEngine.getCurrentNode(sessionState);

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={backToFlowSelect}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerText}>
            Step {sessionState.events.length + 1}
          </Text>
          <TouchableOpacity onPress={resetApp}>
            <Text style={styles.resetLink}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {currentNode.type === 'QUESTION' && (
            <QuestionNodeComponent
              node={currentNode}
              onResponse={handleResponse}
            />
          )}

          {currentNode.type === 'SAFETY' && (
            <SafetyNodeComponent
              node={currentNode}
              onAcknowledge={() => handleResponse(true)}
            />
          )}

          {currentNode.type === 'MEASURE' && (
            <MeasureNodeComponent
              node={currentNode}
              onSubmit={handleResponse}
            />
          )}

          {currentNode.type === 'TERMINAL' && (
            <TerminalNodeComponent
              node={currentNode}
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
  resetLink: {
    fontSize: 14,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
});
