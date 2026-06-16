/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InventoryItem } from '../types';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Coins,
  Bookmark,
  Percent,
  TrendingUp,
  X
} from 'lucide-react';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  onUpdateInventory: (item: any) => void;
  onDeleteInventory: (name: string) => void;
}

export default function InventoryManager({ inventory, onUpdateInventory, onDeleteInventory }: InventoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCat, setSelectedCat] = useState('semua');
  const [isEditing, setIsEditing] = useState(false);

  // Form states for adding/editing manual items
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Sembako');
  const [stock, setStock] = useState(0);
  const [unit, setUnit] = useState('pcs');
  const [averageCost, setAverageCost] = useState(0);
  
  // Custom new requested fields
  const [targetSellingPrice, setTargetSellingPrice] = useState(0);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  
  // AI assist state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const categories = ['Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'];

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCat === 'semua' || item.category === selectedCat;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return {
        label: 'Stok Habis',
        color: 'bg-rose-50 text-rose-700 border-rose-100',
        icon: <AlertOctagon className="h-3.5 w-3.5" />,
        progressColor: 'bg-rose-500',
      };
    } else if (stock < 5) {
      return {
        label: 'Stok Menipis',
        color: 'bg-amber-50 text-amber-700 border-amber-100',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        progressColor: 'bg-amber-500',
      };
    } else {
      return {
        label: 'Stok Aman',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        progressColor: 'bg-emerald-500',
      };
    }
  };

  const startEdit = (item: InventoryItem) => {
    setItemName(item.itemName);
    setCategory(item.category);
    setStock(item.stock);
    setUnit(item.unit);
    setAverageCost(item.averageCost);
    setTargetSellingPrice(item.targetSellingPrice || 0);
    setMaxDiscount(item.maxDiscount || 0);
    setNotes(item.notes || '');
    setAnalysisError('');
    setIsEditing(true);
  };

  const startNew = () => {
    setItemName('');
    setCategory('Sembako');
    setStock(10);
    setUnit('pcs');
    setAverageCost(10000);
    setTargetSellingPrice(0);
    setMaxDiscount(0);
    setNotes('');
    setAnalysisError('');
    setIsEditing(true);
  };

  // Live trigger to hit /api/analyze-restock
  const triggerAIPriceAnalysis = async () => {
    if (!itemName) {
      setAnalysisError('Tulis nama barang terlebih dahulu untuk dianalisis.');
      return;
    }
    if (!averageCost || averageCost <= 0) {
      setAnalysisError('Tulis harga modal pokok terlebih dahulu.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      const response = await fetch('/api/analyze-restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          category,
          averageCost: Number(averageCost),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setTargetSellingPrice(Number(data.hargaJualSaran || 0));
        setMaxDiscount(Number(data.diskonMaksimalSaran || 0));
        setNotes(data.catatanAnalisis || '');
      } else {
        setAnalysisError(data.error || 'Server gagal menganalisis.');
      }
    } catch (err) {
      setAnalysisError('Gagal melakukan panggilan ke asisten AI.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) return;

    onUpdateInventory({
      itemName,
      category,
      stock: Number(stock),
      unit,
      averageCost: Number(averageCost),
      targetSellingPrice: Number(targetSellingPrice || 0),
      maxDiscount: Number(maxDiscount || 0),
      notes: notes || '',
    });

    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 relative overflow-hidden" id="inventory-manager-panel">
      {/* Decorative top strip identical to design HTML */}
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-lg text-slate-800">Manajemen Gudang & Stok</h2>
          <p className="text-xs text-slate-500">Pantau ketersediaan barang, target harga jual, dan diskon aman dari AI</p>
        </div>
        <button
          onClick={startNew}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/15"
          id="btn-add-inventory-stock"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Barang Baru</span>
        </button>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6 bg-slate-50 rounded-2xl p-4 border border-slate-150">
        <div className="text-center border-r border-slate-200 font-medium">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Model Item Unik</div>
          <div className="font-mono text-lg font-bold text-slate-800 mt-1">{inventory.length}</div>
        </div>
        <div className="text-center border-r border-slate-200 font-medium">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Kritikal (Stok &lt; 5)</div>
          <div className="font-mono text-lg font-bold text-amber-600 mt-1">
            {inventory.filter((item) => item.stock < 5).length}
          </div>
        </div>
        <div className="text-center font-medium">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estimasi Nilai Aset</div>
          <div className="font-mono text-xs sm:text-sm font-bold text-emerald-600 mt-1 whitespace-nowrap">
            Rp{' '}
            {inventory
              .reduce((acc, item) => acc + item.stock * item.averageCost, 0)
              .toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari stok di gudang..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700 transition-all font-medium"
          />
        </div>

        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
        >
          <option value="semua">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Editor Modal overlay */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-fade-in" id="inventory-edit-modal">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-display font-semibold text-base text-slate-850">
                {itemName ? 'Edit Barang Gudang' : 'Buat Item Gudang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Nama Barang Dagangan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beras Rojo Lele 5kg"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-705 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold focus:bg-white cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Satuan Unit
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="kg, pouch, bungkus"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-705 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Jumlah Stok
                  </label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-705 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white font-medium"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Rata-rata Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={averageCost}
                    onChange={(e) => setAverageCost(Number(e.target.value))}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-750 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    min="0"
                  />
                </div>
              </div>

              {/* Pricing Guidance Block with AI triggers */}
              <div className="bg-gradient-to-tr from-emerald-50/50 to-teal-50/25 border border-emerald-100 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Kalkulasi Harga & Max Diskon
                  </span>
                  
                  <button
                    type="button"
                    onClick={triggerAIPriceAnalysis}
                    disabled={isAnalyzing || !itemName || !averageCost}
                    className="text-[10.5px] font-bold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Menganalisis...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        <span>Analisis Harga AI</span>
                      </>
                    )}
                  </button>
                </div>

                {analysisError && (
                  <p className="text-[10px] text-red-600 font-semibold">{analysisError}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">
                      Rencana Harga Jual (Rp)
                    </label>
                    <input
                      type="number"
                      placeholder="Contoh: 12500"
                      value={targetSellingPrice}
                      onChange={(e) => setTargetSellingPrice(Number(e.target.value))}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl text-slate-705 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-bold text-rose-600 uppercase mb-1">
                      Maksimum Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      placeholder="Contoh: 1000"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(Number(e.target.value))}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl text-rose-705 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold border-t border-emerald-100/60 pt-2 text-slate-650">
                  <span>Harga jual bersih setelah diskon maksimal:</span>
                  <span className={`font-mono font-bold ${
                    targetSellingPrice - maxDiscount < averageCost ? 'text-red-600' : 'text-emerald-700'
                  }`}>
                    Rp {(targetSellingPrice - maxDiscount).toLocaleString('id-ID')}
                    {targetSellingPrice - maxDiscount < averageCost && ' (RUGI!)'}
                  </span>
                </div>
              </div>

              {/* Notes Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Catatan Produk / Catatan AI
                  </label>
                  <button
                    type="button"
                    onClick={() => setNotes('')}
                    className="text-[9px] text-slate-450 hover:text-slate-600 font-bold"
                  >
                    Hapus Catatan
                  </button>
                </div>
                <textarea
                  placeholder="Isi catatan penting, misalnya: 'Harga modal naik sejak Juni' atau klik tombol Analisis Harga AI untuk saran diskon..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-705 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-700/15"
                  id="save-item-btn"
                >
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid of items */}
      {filteredInventory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/20 border border-dashed border-slate-200 rounded-2xl">
          <Package className="h-8 w-8 text-slate-350 mb-2" />
          <p className="text-xs font-bold text-slate-450">Gudang kosong atau filter pencarian nihil</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInventory.map((item, index) => {
            const status = getStockStatus(item.stock);
            // Calculate a nice percentage bar (e.g. out of 50 for visualization)
            const fillPercent = Math.min(100, (item.stock / 50) * 100);
            
            // Calc standard margins
            const pricingPlanActive = (item.targetSellingPrice && item.targetSellingPrice > 0);
            const displayPrice = pricingPlanActive ? item.targetSellingPrice : Math.round(item.averageCost * 1.2);
            const maxDisc = item.maxDiscount || 0;
            const netSellingPrice = (displayPrice || 0) - maxDisc;
            const isLossAtMaxDiscount = netSellingPrice < item.averageCost;

            return (
              <div
                key={index}
                className="p-5 bg-white border border-slate-150 hover:border-emerald-200 rounded-2xl transition-all shadow-xs flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 duration-250"
                id={`inventory-card-${index}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-[13.5px] tracking-tight">{item.itemName}</h4>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">{item.category}</p>
                    </div>

                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${status.color}`}
                    >
                      {status.icon}
                      <span>{status.label}</span>
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-3.5">
                    <span className="text-lg font-bold text-slate-800 font-mono leading-none">{item.stock}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{item.unit}</span>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-2.5">
                    <div className={`h-1 rounded-full ${status.progressColor}`} style={{ width: `${fillPercent}%` }} />
                  </div>

                  {/* Pricing Matrix Layout */}
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 text-[10.5px]">
                    <div className="grid grid-cols-3 text-slate-500 font-semibold mb-1 border-b border-slate-100 pb-1">
                      <div>Modal</div>
                      <div>Target Jual</div>
                      <div className="text-right">Max Diskon</div>
                    </div>
                    <div className="grid grid-cols-3 font-mono font-bold text-slate-750">
                      <div>Rp {item.averageCost.toLocaleString('id-ID')}</div>
                      <div className="text-emerald-700">Rp {(displayPrice || 0).toLocaleString('id-ID')}</div>
                      <div className="text-rose-600 text-right">Rp {maxDisc.toLocaleString('id-ID')}</div>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] font-semibold pt-1 border-t border-slate-100/60">
                      <span className="text-slate-500">Jual Bersih (Diskon Maks):</span>
                      <span className={`font-bold font-mono ${isLossAtMaxDiscount ? 'bg-red-50 text-red-700 px-1.5 py-0.5 rounded' : 'text-emerald-850'}`}>
                        Rp {netSellingPrice.toLocaleString('id-ID')} {isLossAtMaxDiscount && '(RUGI!)'}
                      </span>
                    </div>
                  </div>

                  {/* Item Notes display */}
                  {item.notes && (
                    <div className="mt-3 p-3 bg-emerald-50/40 border border-emerald-100/60 rounded-xl text-[10.5px] text-emerald-850 leading-relaxed font-medium">
                      <p className="font-extrabold uppercase text-[8.5px] tracking-wider text-emerald-700 mb-0.5 flex items-center gap-0.5">
                        <Bookmark className="h-2.5 w-2.5" /> Catatan Asisten AI / Warung:
                      </p>
                      {item.notes}
                    </div>
                  )}

                </div>

                <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-4">
                  <div className="text-[9.5px] text-slate-400 font-semibold">
                    Produk ID: #{index + 1}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1.5 hover:bg-slate-150 rounded text-slate-500 hover:text-emerald-650 transition-colors cursor-pointer"
                      title="Edit Barang"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus barang ${item.itemName} dari daftar gudang? Data transaksinya akan tetap tersimpan.`)) {
                          onDeleteInventory(item.itemName);
                        }
                      }}
                      className="p-1.5 hover:bg-slate-150 rounded text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Hapus Barang"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
