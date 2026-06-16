/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  timestamp: string; // ISO Date String
  type: 'penjualan' | 'pembelian_stok';
  category: string; // e.g., 'Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'
  itemName: string;
  quantity: number;
  unit: string; // e.g., 'pak', 'kardus', 'kg', 'pcs', 'renteng', 'bks'
  nominal: number; // Penjualan: Total Pendapatan, Pembelian: Total Pengeluaran
  modal: number; // Penjualan: Modal Pokok (COGS), Pembelian: Harga Beli Agen
  rawText: string;
  notes?: string;   // Catatan tambahan opsional (diskon, utang, dll)
  groupId?: string; // ID grup transaksi ganda
}

export interface InventoryItem {
  itemName: string;
  category: string;
  stock: number;
  unit: string;
  averageCost: number; // modal per unit
  lastUpdated: string;
  targetSellingPrice?: number; // Rencana harga penjualan
  maxDiscount?: number;        // Maksimum diskon Rupiah aman
  notes?: string;              // Catatan AI atau edit sendiri
}

export interface CategoryBudget {
  category: string;
  totalSales: number;
  totalProfit: number;
}

export interface ParsedTransactionResult {
  transactionType: 'penjualan' | 'pembelian_stok' | 'unknown';
  category: string;
  itemName: string;
  quantity: number;
  unit: string;
  nominal: number;
  modal: number | null;
  confidenceScore: number;
  explanation: string;
}

export interface WeeklySummary {
  text: string;
  achievement: string; // e.g., "+12% penjualan naik"
  mostSoldItem: string;
  outOfStockOrLow: string[];
  tips: string;
  createdAt: string;
}

export interface UserProfile {
  username: string; // Nama Pemilik / Juragan
  shopName: string; // Nama Toko / Warung
  createdAt: string;
}
