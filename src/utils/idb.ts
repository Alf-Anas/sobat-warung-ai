/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, InventoryItem, UserProfile } from '../types';

const DB_NAME = 'sobat_warung_db';
const DB_VERSION = 2;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('Browser Anda tidak mendukung IndexedDB. Data tidak dapat disimpan secara permanen di lokal.');
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Gagal membuka IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'itemName' });
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
    };
  });
}

export async function getTransactionsFromIDB(): Promise<Transaction[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = request.result || [];
        // Urutkan berdasarkan waktu transaksi terbaru
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error saat membaca transaksi dari IndexedDB:', err);
    return [];
  }
}

export async function getInventoryFromIDB(): Promise<InventoryItem[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readonly');
      const store = tx.objectStore('inventory');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error saat membaca gudang dari IndexedDB:', err);
    return [];
  }
}

export async function saveTransactionToIDB(transaction: Transaction): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const request = store.put(transaction);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saat menyimpan transaksi ke IndexedDB:', err);
  }
}

export async function deleteTransactionFromIDB(id: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saat menghapus transaksi dari IndexedDB:', err);
  }
}

export async function saveInventoryToIDB(item: InventoryItem): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readwrite');
      const store = tx.objectStore('inventory');
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saat menyimpan inventory ke IndexedDB:', err);
  }
}

export async function deleteInventoryFromIDB(itemName: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readwrite');
      const store = tx.objectStore('inventory');
      const request = store.delete(itemName);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saat menghapus inventory dari IndexedDB:', err);
  }
}

export async function clearIDB(): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['transactions', 'inventory'], 'readwrite');
      const txStore = tx.objectStore('transactions');
      const invStore = tx.objectStore('inventory');

      txStore.clear();
      invStore.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error saat membersihkan IndexedDB:', err);
  }
}

export async function overwriteIDB(transactions: Transaction[], inventory: InventoryItem[]): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['transactions', 'inventory'], 'readwrite');
      const txStore = tx.objectStore('transactions');
      const invStore = tx.objectStore('inventory');

      txStore.clear();
      invStore.clear();

      for (const t of transactions) {
        txStore.put(t);
      }
      for (const i of inventory) {
        invStore.put(i);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error saat menimpa data di IndexedDB:', err);
  }
}

export async function getUserProfileFromIDB(): Promise<UserProfile | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      // Check if store exists before accessing
      if (!db.objectStoreNames.contains('profile')) {
        resolve(null);
        return;
      }
      const tx = db.transaction('profile', 'readonly');
      const store = tx.objectStore('profile');
      const request = store.get('user_profile');

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error saat membaca profil dari IndexedDB:', err);
    return null;
  }
}

export async function saveUserProfileToIDB(profile: UserProfile): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profile', 'readwrite');
      const store = tx.objectStore('profile');
      const dataToSave = { ...profile, id: 'user_profile' };
      const request = store.put(dataToSave);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saat menyimpan profil ke IndexedDB:', err);
  }
}

export async function deleteUserProfileFromIDB(): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profile', 'readwrite');
      const store = tx.objectStore('profile');
      const request = store.delete('user_profile');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saat menghapus profil dari IndexedDB:', err);
  }
}

