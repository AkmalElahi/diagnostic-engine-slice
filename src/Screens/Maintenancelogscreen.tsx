import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { MaintenanceService } from '../utils/Maintenanceservice';
import { EquipmentService } from '../utils/Equipmentservice';
import {
  MaintenanceEntry,
  MaintenanceType,
  MAINTENANCE_TYPES,
  getMaintenanceTypeLabel,
  EQUIPMENT_CATEGORIES
} from '../types';

interface Props {
  onBack: () => void;
}

export const MaintenanceLogScreen: React.FC<Props> = ({ onBack }) => {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MaintenanceEntry | null>(
    null,
  );

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = () => {
    const allEntries = MaintenanceService.getAllMaintenanceEntries();
    setEntries(allEntries);
  };

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowAddModal(true);
  };

  const handleEditEntry = (entry: MaintenanceEntry) => {
    setEditingEntry(entry);
    setShowAddModal(true);
  };

  const handleDeleteEntry = (entry: MaintenanceEntry) => {
    Alert.alert(
      'Delete Maintenance Entry',
      `Are you sure you want to delete this ${entry.artifact.maintenance_type.toLowerCase()} entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            MaintenanceService.deleteMaintenanceEntry(entry.id);
            loadEntries();
          },
        },
      ],
    );
  };

  const handleSaveEntry = () => {
    loadEntries();
    setShowAddModal(false);
    setEditingEntry(null);
  };

  const filteredEntries = entries.filter((entry) => {
    if (selectedType === 'All') return true;
    return entry.artifact.maintenance_type === selectedType;
  });

  const typeCounts = MaintenanceService.getMaintenanceCountsByType();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Maintenance Log</Text>
        <TouchableOpacity onPress={handleAddEntry}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedType === 'All' && styles.filterButtonActive,
          ]}
          onPress={() => setSelectedType('All')}
        >
          <Text
            style={[
              styles.filterButtonText,
              selectedType === 'All' && styles.filterButtonTextActive,
            ]}
          >
            All ({entries.length})
          </Text>
        </TouchableOpacity>

        {MAINTENANCE_TYPES.map((type) => {
          const count = typeCounts[type];
          if (count === 0) return null;

          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                selectedType === type && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedType === type && styles.filterButtonTextActive,
                ]}
              >
                {getMaintenanceTypeLabel(type)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filteredEntries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {selectedType !== 'All'
              ? `No ${selectedType.toLowerCase()} entries`
              : 'No maintenance entries yet'}
          </Text>
          {selectedType === 'All' && (
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={handleAddEntry}
            >
              <Text style={styles.emptyAddButtonText}>Add First Entry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.entryCard}
              onPress={() => handleEditEntry(item)}
            >
              <View style={styles.entryHeader}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryType}>
                    {getMaintenanceTypeLabel(item.artifact.maintenance_type)}
                  </Text>
                  <Text style={styles.entryDate}>
                    {new Date(
                      item.artifact.maintenance_date,
                    ).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteEntry(item)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.entryComponent}>
                {item.artifact.component_type}
              </Text>
              <Text style={styles.entryDescription} numberOfLines={2}>
                {item.artifact.description}
              </Text>
              {item.artifact.performed_by && (
                <Text style={styles.entryDetail}>
                  Performed by: {item.artifact.performed_by}
                </Text>
              )}
              {item.artifact.part_number && (
                <Text style={styles.entryDetail}>
                  Part #: {item.artifact.part_number}
                </Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {showAddModal && (
        <MaintenanceFormModal
          entry={editingEntry}
          onSave={handleSaveEntry}
          onCancel={() => {
            setShowAddModal(false);
            setEditingEntry(null);
          }}
        />
      )}
    </View>
  );
};

interface FormModalProps {
  entry: MaintenanceEntry | null;
  onSave: () => void;
  onCancel: () => void;
}
const MaintenanceFormModal: React.FC<FormModalProps> = ({
  entry,
  onSave,
  onCancel,
}) => {
  const [maintenanceDate, setMaintenanceDate] = useState(
    entry?.artifact.maintenance_date || new Date().toISOString().split('T')[0],
  );
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>(
    entry?.artifact.maintenance_type || 'REPAIR',
  );
  const [componentType, setComponentType] = useState(
    entry?.artifact.component_type || 'Appliance',
  );
  const [description, setDescription] = useState(
    entry?.artifact.description || '',
  );
  const [performedBy, setPerformedBy] = useState(
    entry?.artifact.performed_by || '',
  );
  const [partNumber, setPartNumber] = useState(
    entry?.artifact.part_number || '',
  );
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(
    entry?.artifact.equipment_id || '',
  );

  const equipment = EquipmentService.getAllEquipment();

  const handleSave = () => {
    if (!description.trim()) {
      Alert.alert('Required Field', 'Please enter a description');
      return;
    }

    try {
      if (entry) {
        MaintenanceService.updateMaintenanceEntry(entry.id, {
          maintenance_date: maintenanceDate,
          maintenance_type: maintenanceType,
          component_type: componentType,
          description: description.trim(),
          performed_by: performedBy.trim() || undefined,
          part_number: partNumber.trim() || undefined,
          equipment_id: selectedEquipmentId || undefined,
        });
      } else {
        MaintenanceService.addMaintenanceEntry({
          maintenance_date: maintenanceDate,
          maintenance_type: maintenanceType,
          component_type: componentType,
          description: description.trim(),
          performed_by: performedBy.trim() || undefined,
          part_number: partNumber.trim() || undefined,
          equipment_id: selectedEquipmentId || undefined,
        });
      }
      onSave();
    } catch (error) {
      Alert.alert('Error', 'Failed to save maintenance entry');
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.modalCancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {entry ? 'Edit Entry' : 'Add Maintenance'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.modalSaveButton}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.label}>Type *</Text>
          <View style={styles.typeButtons}>
            {MAINTENANCE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  maintenanceType === type && styles.typeButtonActive,
                ]}
                onPress={() => setMaintenanceType(type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    maintenanceType === type && styles.typeButtonTextActive,
                  ]}
                >
                  {getMaintenanceTypeLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={maintenanceDate}
            onChangeText={setMaintenanceDate}
          />
          <Text style={styles.label}>Component Type *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.componentScroll}
          >
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.componentButton,
                  componentType === cat && styles.componentButtonActive,
                ]}
                onPress={() => setComponentType(cat)}
              >
                <Text
                  style={[
                    styles.componentButtonText,
                    componentType === cat && styles.componentButtonTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the work performed..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.label}>Performed By</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Owner, Mobile Tech, Service Center"
            value={performedBy}
            onChangeText={setPerformedBy}
            maxLength={100}
          />
          <Text style={styles.label}>Part Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            value={partNumber}
            onChangeText={setPartNumber}
            maxLength={50}
          />
          {equipment.length > 0 && (
            <>
              <Text style={styles.label}>Link to Equipment (Optional)</Text>
              <View style={styles.equipmentPicker}>
                <TouchableOpacity
                  style={[
                    styles.equipmentOption,
                    !selectedEquipmentId && styles.equipmentOptionActive,
                  ]}
                  onPress={() => setSelectedEquipmentId('')}
                >
                  <Text
                    style={[
                      styles.equipmentOptionText,
                      !selectedEquipmentId && styles.equipmentOptionTextActive,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>
                {equipment.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.equipmentOption,
                      selectedEquipmentId === item.id &&
                        styles.equipmentOptionActive,
                    ]}
                    onPress={() => setSelectedEquipmentId(item.id)}
                  >
                    <Text
                      style={[
                        styles.equipmentOptionText,
                        selectedEquipmentId === item.id &&
                          styles.equipmentOptionTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: { fontSize: 16, color: '#2196F3' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  addButton: { fontSize: 16, color: '#2196F3', fontWeight: '600' },
  filterScroll: { maxHeight: 50 },
  filterContainer: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterButtonActive: { backgroundColor: '#2196F3' },
  filterButtonText: { fontSize: 14, color: '#666' },
  filterButtonTextActive: { color: '#fff', fontWeight: '600' },
  listContent: { padding: 16 },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryInfo: { flex: 1 },
  entryType: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    marginBottom: 2,
  },
  entryDate: { fontSize: 12, color: '#999' },
  entryComponent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  entryDescription: { fontSize: 14, color: '#666', marginBottom: 8 },
  entryDetail: { fontSize: 12, color: '#999', marginTop: 4 },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { fontSize: 20, color: '#f44336', fontWeight: 'bold' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: { fontSize: 16, color: '#999', marginBottom: 16 },
  emptyAddButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelButton: { fontSize: 16, color: '#666' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalSaveButton: { fontSize: 16, color: '#2196F3', fontWeight: '600' },
  modalContent: { flex: 1, padding: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  typeButtonActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  typeButtonText: { fontSize: 14, color: '#666' },
  typeButtonTextActive: { color: '#fff', fontWeight: '600' },
  componentScroll: { maxHeight: 50, marginBottom: 8 },
  componentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  componentButtonActive: { backgroundColor: '#2196F3' },
  componentButtonText: { fontSize: 14, color: '#666' },
  componentButtonTextActive: { color: '#fff', fontWeight: '600' },
  equipmentPicker: { gap: 8 },
  equipmentOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  equipmentOptionActive: { backgroundColor: '#e3f2fd', borderColor: '#2196F3' },
  equipmentOptionText: { fontSize: 14, color: '#666' },
  equipmentOptionTextActive: { color: '#2196F3', fontWeight: '600' },
});
