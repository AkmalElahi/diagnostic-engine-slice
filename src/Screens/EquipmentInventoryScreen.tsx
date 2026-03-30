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
import { EquipmentService } from '../services/Equipmentservice';
import { EquipmentItem, EQUIPMENT_CATEGORIES } from '../types';

interface Props {
  onBack: () => void;
}

export const EquipmentInventoryScreen: React.FC<Props> = ({ onBack }) => {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = () => {
    const items = EquipmentService.getAllEquipment();
    setEquipment(items);
  };

  const handleAddEquipment = () => {
    setEditingItem(null);
    setShowAddModal(true);
  };

  const handleEditEquipment = (item: EquipmentItem) => {
    setEditingItem(item);
    setShowAddModal(true);
  };

  const handleDeleteEquipment = (item: EquipmentItem) => {
    Alert.alert(
      'Delete Equipment',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            EquipmentService.deleteEquipment(item.id);
            loadEquipment();
          },
        },
      ]
    );
  };

  const handleSaveEquipment = () => {
    loadEquipment();
    setShowAddModal(false);
    setEditingItem(null);
  };

  // Filter equipment
  const filteredEquipment = equipment.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  // Get category counts
  const categoryCounts = equipment.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Equipment Inventory</Text>
        <TouchableOpacity onPress={handleAddEquipment}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search equipment..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'All' && styles.categoryButtonActive,
          ]}
          onPress={() => setSelectedCategory('All')}
        >
          <Text
            style={[
              styles.categoryButtonText,
              selectedCategory === 'All' && styles.categoryButtonTextActive,
            ]}
          >
            All ({equipment.length})
          </Text>
        </TouchableOpacity>

        {EQUIPMENT_CATEGORIES.map(category => {
          const count = categoryCounts[category] || 0;
          if (count === 0) return null;
          
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextActive,
                ]}
              >
                {category} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Equipment List */}
      {filteredEquipment.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery || selectedCategory !== 'All'
              ? 'No equipment found'
              : 'No equipment added yet'}
          </Text>
          {searchQuery === '' && selectedCategory === 'All' && (
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={handleAddEquipment}
            >
              <Text style={styles.emptyAddButtonText}>Add First Equipment</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredEquipment}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.equipmentCard}
              // onPress={() => handleEditEquipment(item)}
            >
              <View style={styles.equipmentHeader}>
                <View style={styles.equipmentInfo}>
                  <Text style={styles.equipmentName}>{item.name}</Text>
                  <Text style={styles.equipmentCategory}>{item.category}</Text>
                </View>
                {/* <TouchableOpacity
                  onPress={() => handleDeleteEquipment(item)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>×</Text>
                </TouchableOpacity> */}
              </View>

              {item.manufacturer && (
                <Text style={styles.equipmentDetail}>
                  Manufacturer: {item.manufacturer}
                </Text>
              )}
              {item.model_number && (
                <Text style={styles.equipmentDetail}>
                  Model: {item.model_number}
                </Text>
              )}
              {item.serial_number && (
                <Text style={styles.equipmentDetail}>
                  S/N: {item.serial_number}
                </Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <EquipmentFormModal
          item={editingItem}
          onSave={handleSaveEquipment}
          onCancel={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </View>
  );
};

// ─── Equipment Form Modal ───────────────────────────────────────────────────

interface FormModalProps {
  item: EquipmentItem | null;
  onSave: () => void;
  onCancel: () => void;
}

const EquipmentFormModal: React.FC<FormModalProps> = ({ item, onSave, onCancel }) => {
  const [category, setCategory] = useState(item?.category || 'Appliance');
  const [name, setName] = useState(item?.name || '');
  const [manufacturer, setManufacturer] = useState(item?.manufacturer || '');
  const [modelNumber, setModelNumber] = useState(item?.model_number || '');
  const [serialNumber, setSerialNumber] = useState(item?.serial_number || '');
  const [notes, setNotes] = useState(item?.notes || '');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter equipment name');
      return;
    }

    try {
      if (item) {
        // Update existing
        EquipmentService.updateEquipment(item.id, {
          category,
          name: name.trim(),
          manufacturer: manufacturer.trim() || undefined,
          model_number: modelNumber.trim() || undefined,
          serial_number: serialNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        // Add new
        EquipmentService.addEquipment({
          category,
          name: name.trim(),
          manufacturer: manufacturer.trim() || undefined,
          model_number: modelNumber.trim() || undefined,
          serial_number: serialNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      
      onSave();
    } catch (error) {
      Alert.alert('Error', 'Failed to save equipment');
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
            {item ? 'Edit Equipment' : 'Add Equipment'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.modalSaveButton}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Category */}
          <Text style={styles.label}>Category *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryPickerScroll}
          >
            {EQUIPMENT_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPickerButton,
                  category === cat && styles.categoryPickerButtonActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryPickerText,
                    category === cat && styles.categoryPickerTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Name */}
          <Text style={styles.label}>Equipment Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Dometic Refrigerator"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          {/* Manufacturer */}
          <Text style={styles.label}>Manufacturer</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Dometic"
            value={manufacturer}
            onChangeText={setManufacturer}
            maxLength={50}
          />

          {/* Model Number */}
          <Text style={styles.label}>Model Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., DM2652"
            value={modelNumber}
            onChangeText={setModelNumber}
            maxLength={50}
          />

          {/* Serial Number */}
          <Text style={styles.label}>Serial Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Serial number"
            value={serialNumber}
            onChangeText={setSerialNumber}
            maxLength={50}
          />

          {/* Notes */}
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Additional notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

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
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  equipmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  equipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  equipmentCategory: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  equipmentDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#f44336',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
  },
  emptyAddButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSaveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryPickerScroll: {
    maxHeight: 50,
    marginBottom: 8,
  },
  categoryPickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  categoryPickerButtonActive: {
    backgroundColor: '#2196F3',
  },
  categoryPickerText: {
    fontSize: 14,
    color: '#666',
  },
  categoryPickerTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});