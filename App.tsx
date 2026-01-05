import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { FlowEngine } from './src/utils/FlowEngine';
import { FlowDefinition, SessionState, SessionSummary } from './src/types';
import { QuestionNodeComponent } from './src/components/QuestionNodeComponent';
import { SafetyNodeComponent } from './src/components/SafetyNodeComponent';
import { MeasureNodeComponent } from './src/components/MeasureNodeComponent';
import { TerminalNodeComponent } from './src/components/TerminalNodeComponent';
import { HistoryView } from './src/components/HistoryView';
import { StorageService } from './src/utils/StorageService';

import sampleFlow from './src/flows/sample_flow.json';

type ViewMode = 'diagnostic' | 'history';

export default function App() {
  const [flowEngine] = useState(() => new FlowEngine(sampleFlow as FlowDefinition));
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('diagnostic');
  const [history, setHistory] = useState<SessionSummary[]>([]);

  useEffect(() => {
    const existingSession = flowEngine.resumeSession();
    if (existingSession) {
      setSessionState(existingSession);
      
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
    loadHistory();
  }, []);

  const loadHistory = () => {
    const loadedHistory = FlowEngine.getHistory();
    setHistory(loadedHistory);
  };

  const startNewSession = () => {
    const newSession = flowEngine.startSession();
    setSessionState(newSession);
    setSessionSummary(null);
  };

  const handleResponse = (value: string | number | boolean) => {
    if (!sessionState) return;

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
  };

  const showHistory = () => {
    loadHistory();
    setViewMode('history');
  };

  const closeHistory = () => {
    setViewMode('diagnostic');
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
            setSessionState(null);
            setSessionSummary(null);
            loadHistory();
          },
        },
      ]
    );
  };

  if (viewMode === 'history') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <HistoryView
          history={history}
          onClose={closeHistory}
          onClearHistory={clearHistory}
        />
      </SafeAreaView>
    );
  }

  if (!sessionState) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>RV Diagnostic Engine</Text>
          <Text style={styles.welcomeSubtitle}>
            Offline-first diagnostic flow system
          </Text>
          
          <TouchableOpacity
            style={styles.startButton}
            onPress={startNewSession}
          >
            <Text style={styles.startButtonText}>START DIAGNOSTIC</Text>
          </TouchableOpacity>

          {history.length > 0 && (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={showHistory}
            >
              <Text style={styles.historyButtonText}>
                VIEW HISTORY ({history.length})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetApp}
          >
            <Text style={styles.resetButtonText}>RESET APP</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentNode = flowEngine.getCurrentNode(sessionState);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerText}>
          RV Diagnostic - Step {sessionState.events.length + 1}
        </Text>
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
            onStartNew={startNewSession}
            onViewHistory={showHistory}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  content: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 50,
    color: '#666',
  },
  startButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  historyButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
  },
  historyButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});
