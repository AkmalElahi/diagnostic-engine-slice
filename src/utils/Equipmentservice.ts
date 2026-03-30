import { EquipmentItem } from '../types';
import { RigIdentityService } from './RigIdentityService';
import { StorageService } from './StorageService';
import * as Crypto from 'expo-crypto';

export class EquipmentService {
  static getAllEquipment(): EquipmentItem[] {
    try {
      const items = StorageService.getEquipmentInventory();
      const currentRig = RigIdentityService.getOrCreate();
      return items
        .filter((item) => item.rig_id === currentRig.id)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    } catch (error) {
      console.error('[EquipmentService] Failed to get equipment:', error);
      return [];
    }
  }

  static getEquipmentById(id: string): EquipmentItem | null {
    const items = this.getAllEquipment();
    return items.find((item) => item.id === id) || null;
  }

  static getEquipmentByCategory(category: string): EquipmentItem[] {
    return this.getAllEquipment().filter((item) => item.category === category);
  }

  static addEquipment(
    data: Omit<EquipmentItem, 'id' | 'rig_id' | 'created_at'>,
  ): EquipmentItem {
    try {
      const currentRig = RigIdentityService.getOrCreate();

      const newItem: EquipmentItem = {
        id: Crypto.randomUUID(),
        rig_id: currentRig.id,
        created_at: new Date().toISOString(),
        ...data,
      };

      const items = StorageService.getEquipmentInventory();
      items.push(newItem);
      StorageService.saveEquipmentInventory(items);

      console.log(
        '[EquipmentService] Added equipment:',
        newItem.id,
        newItem.name,
      );
      return newItem;
    } catch (error) {
      console.error('[EquipmentService] Failed to add equipment:', error);
      throw new Error('Failed to add equipment');
    }
  }

  static updateEquipment(
    id: string,
    updates: Partial<Omit<EquipmentItem, 'id' | 'rig_id' | 'created_at'>>,
  ): EquipmentItem | null {
    try {
      const items = StorageService.getEquipmentInventory();
      const index = items.findIndex((item) => item.id === id);

      if (index === -1) {
        console.warn('[EquipmentService] Equipment not found:', id);
        return null;
      }

      items[index] = {
        ...items[index],
        ...updates,
      };

      StorageService.saveEquipmentInventory(items);

      console.log('[EquipmentService] Updated equipment:', id);
      return items[index];
    } catch (error) {
      console.error('[EquipmentService] Failed to update equipment:', error);
      throw new Error('Failed to update equipment');
    }
  }

  static deleteEquipment(id: string): boolean {
    try {
      const items = StorageService.getEquipmentInventory();
      const filteredItems = items.filter((item) => item.id !== id);

      if (filteredItems.length === items.length) {
        console.warn('[EquipmentService] Equipment not found:', id);
        return false;
      }

      StorageService.saveEquipmentInventory(filteredItems);

      console.log('[EquipmentService] Deleted equipment:', id);
      return true;
    } catch (error) {
      console.error('[EquipmentService] Failed to delete equipment:', error);
      throw new Error('Failed to delete equipment');
    }
  }

  static searchEquipment(query: string): EquipmentItem[] {
    const lowerQuery = query.toLowerCase();

    return this.getAllEquipment().filter((item) => {
      return (
        item.name.toLowerCase().includes(lowerQuery) ||
        item.manufacturer?.toLowerCase().includes(lowerQuery) ||
        item.model_number?.toLowerCase().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery)
      );
    });
  }

  static getEquipmentCount(): number {
    return this.getAllEquipment().length;
  }

  static clearAllEquipment(): void {
    try {
      StorageService.clearEquipmentInventory();
      console.log('[EquipmentService] All equipment cleared');
    } catch (error) {
      console.error('[EquipmentService] Failed to clear equipment:', error);
    }
  }
}
