/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Transaction, InventoryItem, UserProfile } from './types';
import VoiceAssistant from './components/VoiceAssistant';
import TransactionList from './components/TransactionList';
import InventoryManager from './components/InventoryManager';
import WeekendReport from './components/WeekendReport';
import SocialMediaGenerator from './components/SocialMediaGenerator';
import {
  Store,
  DollarSign,
  Warehouse,
  RotateCcw,
  Database,
  ArrowUpRight,
  Sparkles,
  Shield,
  Layers,
  HelpCircle,
  Settings,
  User,
  Save,
  Trash2,
  AlertTriangle,
  Share2,
  Instagram
} from 'lucide-react';
import {
  getTransactionsFromIDB,
  getInventoryFromIDB,
  saveInventoryToIDB,
  deleteInventoryFromIDB,
  deleteTransactionFromIDB,
  clearIDB,
  overwriteIDB,
  getUserProfileFromIDB,
  saveUserProfileToIDB,
  deleteUserProfileFromIDB
} from './utils/idb';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'voice-hub' | 'gudang-stock' | 'keuangan-ledger' | 'laporan-minggu' | 'pemasaran-sosmed' | 'pengaturan'>('voice-hub');
  const [isResetting, setIsResetting] = useState(false);

  // Profile states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inputProfileName, setInputProfileName] = useState('');
  const [inputShopName, setInputShopName] = useState('');

  // Load data: IndexedDB first, then sync server
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil data profil lokal terlebih dahulu
      const localProfile = await getUserProfileFromIDB();
      if (localProfile) {
        setProfile(localProfile);
        setInputProfileName(localProfile.username);
        setInputShopName(localProfile.shopName);
      }

      // 2. Ambil transaksi dan stok lokal untuk pemuatan instan
      const localTxs = await getTransactionsFromIDB();
      const localInv = await getInventoryFromIDB();
      
      setTransactions(localTxs);
      setInventory(localInv);

      // 3. Hubungkan ke server API di latar belakang untuk sinkronisasi
      const response = await fetch('/api/data');
      if (response.ok) {
        const data = await response.json();
        const serverTxs: Transaction[] = data.transactions || [];
        const serverInv: InventoryItem[] = data.inventory || [];

        // Selalu sinkronkan data server ke IndexedDB lokal jika ada konten
        await overwriteIDB(serverTxs, serverInv);
        
        // Perbarui state aplikasi
        setTransactions(serverTxs);
        setInventory(serverInv);
      }
    } catch (error) {
      console.error('Error saat menyinkronkan data dengan server:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputProfileName.trim() || !inputShopName.trim()) {
      alert('Nama Pemilik dan Nama Toko/Warung wajib diisi!');
      return;
    }
    const newProfile: UserProfile = {
      username: inputProfileName.trim(),
      shopName: inputShopName.trim(),
      createdAt: new Date().toISOString()
    };
    await saveUserProfileToIDB(newProfile);
    setProfile(newProfile);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputProfileName.trim() || !inputShopName.trim()) {
      alert('Nama Pemilik dan Nama Toko/Warung wajib diisi!');
      return;
    }
    const updatedProfile: UserProfile = {
      username: inputProfileName.trim(),
      shopName: inputShopName.trim(),
      createdAt: profile?.createdAt || new Date().toISOString()
    };
    await saveUserProfileToIDB(updatedProfile);
    setProfile(updatedProfile);
    alert('Profil toko Anda berhasil diperbarui!');
  };

  // Update specific manual inventory items
  const handleUpdateInventory = async (item: InventoryItem) => {
    try {
      // 1. Simpan di IndexedDB secara instan
      await saveInventoryToIDB(item);
      
      // Update state dengan cepat untuk performansi UI yang responsif
      setInventory((prev) => {
        const idx = prev.findIndex((i) => i.itemName.toLowerCase() === item.itemName.toLowerCase());
        if (idx > -1) {
          const updated = [...prev];
          updated[idx] = item;
          return updated;
        } else {
          return [...prev, item];
        }
      });

      // 2. Kirim update ke server di background
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.inventory) {
          await overwriteIDB(transactions, data.inventory);
          setInventory(data.inventory);
        }
      }
    } catch (err) {
      console.error('Gagal memperbarui gudang:', err);
    }
  };

  // Delete manual item from inventory
  const handleDeleteInventory = async (name: string) => {
    try {
      // 1. Hapus dari IndexedDB lokal
      await deleteInventoryFromIDB(name);
      setInventory((prev) => prev.filter((i) => i.itemName.toLowerCase() !== name.toLowerCase()));

      // 2. Kirim sinyal hapus ke server di background
      const response = await fetch(`/api/inventory/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.inventory) {
          await overwriteIDB(transactions, data.inventory);
          setInventory(data.inventory);
        }
      }
    } catch (err) {
      console.error('Gagal menghapus barang dari gudang:', err);
    }
  };

  // Delete specific transaction and rollback stock
  const handleDeleteTransaction = async (id: string) => {
    try {
      // 1. Hapus transaksi dari lokal IndexedDB secara optimis
      await deleteTransactionFromIDB(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));

      // 2. Kirim sinyal hapus ke server
      const response = await fetch(`/api/transaction/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.inventory) {
          const updatedTxs = transactions.filter((t) => t.id !== id);
          await overwriteIDB(updatedTxs, data.inventory);
          setTransactions(updatedTxs);
          setInventory(data.inventory);
        }
      }
    } catch (err) {
      console.error('Gagal menghapus catatan transaksi:', err);
    }
  };

  // Kosongkan Catatan Transaksi & Stok Kembali ke 0 (Profil tetap disimpan)
  const handleResetData = async () => {
    if (
      !confirm(
        'Apakah Anda yakin ingin mengosongkan catatan transaksi dan stok kembali ke 0? Profil warung Anda tetap akan disimpan.'
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        // Kosongkan kueri lokal transaksi & stok
        await clearIDB();
        setTransactions([]);
        setInventory([]);
        alert('Semua data transaksi dan stok berhasil dikosongkan!');
      }
    } catch (err) {
      console.error('Gagal mengosongkan database:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Reset total termasuk profil (Kembali ke halaman buat akun/onboarding)
  const handleResetAllTotal = async () => {
    if (
      !confirm(
        'PERINGATAN: Tindakan ini akan menghapus TOTAL data transaksi, stok, DAN profil warung Anda. Aplikasi akan kembali ke halaman awal pembuatan akun. Lanjutkan?'
      )
    ) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        // Hapus total data & profil di lokal
        await clearIDB();
        await deleteUserProfileFromIDB();
        setProfile(null);
        setInputProfileName('');
        setInputShopName('');
        setTransactions([]);
        setInventory([]);
        setActiveTab('voice-hub');
        alert('Seluruh data dan profil berhasil dihapus secara total!');
      }
    } catch (err) {
      console.error('Gagal melalukan reset total:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Analisis kalkulasi finansial real-time
  const totalOmset = transactions
    .filter((tx) => tx.type === 'penjualan')
    .reduce((acc, tx) => acc + tx.nominal, 0);

  const totalModalCOGS = transactions
    .filter((tx) => tx.type === 'penjualan')
    .reduce((acc, tx) => acc + tx.modal, 0);

  const totalLabaBersih = totalOmset - totalModalCOGS;

  const totalBelanjaStok = transactions
    .filter((tx) => tx.type === 'pembelian_stok')
    .reduce((acc, tx) => acc + tx.nominal, 0);

  if (isLoading && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-semibold text-slate-500">Memuat asisten SuaraWarung...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" id="onboarding-root">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 relative overflow-hidden">
          {/* Decorative gradients */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-50 rounded-full blur-xl" />
          
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 border border-emerald-100 shadow-sm shadow-emerald-50">
              <Store className="h-8 w-8" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-display font-semibold text-slate-800 tracking-tight">
              Selamat Datang!
            </h2>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Mulai pembukuan digital & stok warung secara praktis hanya menggunakan asisten suara AI pintar Anda.
            </p>
          </div>

          <form onSubmit={handleCreateProfile} className="mt-8 space-y-5">
            <div>
              <label htmlFor="owner-name-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Nama Anda / Pemilik Warung
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  id="owner-name-input"
                  required
                  placeholder="Contoh: Bos Anas"
                  value={inputProfileName}
                  onChange={(e) => setInputProfileName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl text-sm font-medium transition-all text-slate-800 placeholder-slate-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="shop-name-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Nama Toko / Warung
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Store className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  id="shop-name-input"
                  required
                  placeholder="Contoh: Warung Berkah Abadi"
                  value={inputShopName}
                  onChange={(e) => setInputShopName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl text-sm font-medium transition-all text-slate-800 placeholder-slate-400 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-100/50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Buat Akon & Mulai Sekarang</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Shield className="h-3 w-3 text-emerald-500" /> Profil & data riwayat 100% tersimpan aman di browser (IndexedDB)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-900 pb-20 lg:pb-0" id="suara-warung-root">
      
      {/* Sidebar Navigation - Desktop view */}
      <aside className="w-68 bg-white border-r border-slate-200 hidden lg:flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-emerald-600 font-bold text-xl tracking-tight">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <Store className="h-4.5 w-4.5" />
            </div>
            <span>SobatWarung AI</span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold tracking-wide italic mt-1.5 leading-tight">
            "Solusi Pintar Keuangan & Pemasaran UMKM"
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <button
            onClick={() => setActiveTab('voice-hub')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left cursor-pointer ${
              activeTab === 'voice-hub'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-4.5 w-4.5" />
            Asisten & Entri Manual Hub
          </button>
          
          <button
            onClick={() => setActiveTab('gudang-stock')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left cursor-pointer ${
              activeTab === 'gudang-stock'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Warehouse className="h-4.5 w-4.5" />
            Stok Barang & Gudang
          </button>

          <button
            onClick={() => setActiveTab('keuangan-ledger')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left cursor-pointer ${
              activeTab === 'keuangan-ledger'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <DollarSign className="h-4.5 w-4.5" />
            Keuangan & Buku
          </button>
          
          <button
            onClick={() => setActiveTab('laporan-minggu')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left cursor-pointer ${
              activeTab === 'laporan-minggu'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-4.5 w-4.5" />
            Laporan AI
          </button>

          <button
            onClick={() => setActiveTab('pemasaran-sosmed')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left cursor-pointer ${
              activeTab === 'pemasaran-sosmed'
                ? 'bg-emerald-50 text-emerald-700 font-bold border-l-2 border-emerald-500'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Share2 className="h-4.5 w-4.5 text-pink-500" />
            Pemasaran Sosmed
          </button>

          <button
            onClick={() => setActiveTab('pengaturan')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left cursor-pointer ${
              activeTab === 'pengaturan'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Settings className="h-4.5 w-4.5" />
            Pengaturan Toko
          </button>
        </nav>

        {/* System Health Info */}
        <div className="p-5 mt-auto bg-slate-50 m-4 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status Sistem</p>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Siap Mencatat (IndexedDB)
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">ID: 37b58849-3c50</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar - Sticky at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex justify-around items-center py-2 px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden">
        <button
          onClick={() => setActiveTab('voice-hub')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'voice-hub' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Sparkles className="h-4.5 w-4.5 mb-0.5" />
          <span className="text-[9px] font-bold">Voice AI</span>
        </button>
        <button
          onClick={() => setActiveTab('gudang-stock')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'gudang-stock' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Warehouse className="h-4.5 w-4.5 mb-0.5" />
          <span className="text-[9px] font-bold">Stok</span>
        </button>
        <button
          onClick={() => setActiveTab('keuangan-ledger')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'keuangan-ledger' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <DollarSign className="h-4.5 w-4.5 mb-0.5" />
          <span className="text-[9px] font-bold">Keuangan</span>
        </button>
        <button
          onClick={() => setActiveTab('laporan-minggu')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'laporan-minggu' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="h-4.5 w-4.5 mb-0.5" />
          <span className="text-[9px] font-bold">Laporan</span>
        </button>
        <button
          onClick={() => setActiveTab('pemasaran-sosmed')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'pemasaran-sosmed' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Share2 className="h-4.5 w-4.5 mb-0.5" />
          <span className="text-[9px] font-bold">Medsos</span>
        </button>
        <button
          onClick={() => setActiveTab('pengaturan')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'pengaturan' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Settings className="h-4.5 w-4.5 mb-0.5" />
          <span className="text-[9px] font-bold">Setting</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-medium text-slate-800">Halo, Bos {profile?.username}!</h1>
              <p className="text-xs md:text-sm text-slate-500">
                {profile?.shopName} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                <Database className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span>Offline IndexedDB Aktif</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable body wrapper */}
        <div className="p-6 md:p-8 space-y-6 pb-24 lg:pb-8">

          {/* Conditional Rendering based on selected tab */}
          {activeTab === 'voice-hub' && (
            <div className="space-y-6 max-w-4xl mx-auto animate-fade-in" id="tab-voice-hub">
              {/* Quick Tips on AI input */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-[20px] flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-900 font-display">💡 Tips Penggunaan Asisten Voice AI:</p>
                  <p className="text-[11.5px] text-emerald-800 mt-0.5 leading-relaxed">
                    Cukup tekan tombol <strong className="text-emerald-950 font-bold">mikrofon hijau besar</strong> lalu katakan transaksi Anda (misalnya: <span className="italic">"Laku beras rojo lele 2 kg harga 30 ribu modalnya 24 ribu"</span>). Entitas akan otomatis terpecah dan tercatat secara instan oleh Gemini AI!
                  </p>
                </div>
              </div>

              {/* Voice Perekam/Input Card */}
              <VoiceAssistant onTransactionAdded={loadData} inventory={inventory} />
            </div>
          )}

          {activeTab === 'gudang-stock' && (
            <div className="max-w-5xl mx-auto animate-fade-in" id="tab-gudang-stock">
              <InventoryManager
                inventory={inventory}
                onUpdateInventory={handleUpdateInventory}
                onDeleteInventory={handleDeleteInventory}
              />
            </div>
          )}

          {activeTab === 'keuangan-ledger' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-fade-in" id="tab-keuangan-ledger">
              
              {/* KPI metrics row inside Keuangan ledger */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="kpi-dashboard-metrics">
                
                {/* Metric 1: Omset */}
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-lg shadow-slate-205/30 p-6 flex items-center justify-between transition-all hover:shadow-xl hover:-translate-y-0.5 duration-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Total Omset Penjualan
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-slate-800 tracking-tight block mt-1.5">
                      Rp {totalOmset.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10.5px] text-emerald-650 font-bold block mt-1.5">
                      Dari {transactions.filter((t) => t.type === 'penjualan').length} transaksi laku
                    </span>
                  </div>
                  <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                </div>

                {/* Metric 2: Laba Bersih */}
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-lg shadow-slate-205/30 p-6 flex items-center justify-between transition-all hover:shadow-xl hover:-translate-y-0.5 duration-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Keuntungan Bersih (Laba)
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-emerald-600 tracking-tight block mt-1.5">
                      Rp {totalLabaBersih.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10.5px] text-emerald-650 font-bold block mt-1.5">
                      Margin Sehat {totalOmset > 0 ? Math.round((totalLabaBersih / totalOmset) * 105) / 1.05 : 0}%
                    </span>
                  </div>
                  <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>

                {/* Metric 3: Total Kulakan */}
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-lg shadow-slate-205/30 p-6 flex items-center justify-between transition-all hover:shadow-xl hover:-translate-y-0.5 duration-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Keluar Belanja Stok (Kulak)
                    </span>
                    <span className="font-mono text-2xl font-extrabold text-slate-800 block mt-1.5">
                      Rp {totalBelanjaStok.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-bold block mt-1.5">
                      Menyediakan {transactions.filter((t) => t.type === 'pembelian_stok').length} barang masuk
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 text-slate-600 rounded-2xl shadow-xs">
                    <Warehouse className="h-5 w-5" />
                  </div>
                </div>

              </div>

              {/* Transactions List */}
              <TransactionList
                transactions={transactions}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </div>
          )}

          {activeTab === 'laporan-minggu' && (
            <div className="max-w-4xl mx-auto animate-fade-in" id="tab-laporan-minggu">
              <WeekendReport transactions={transactions} inventory={inventory} />
            </div>
          )}

          {activeTab === 'pemasaran-sosmed' && (
            <div className="max-w-4xl mx-auto animate-fade-in" id="tab-pemasaran-sosmed">
              <SocialMediaGenerator inventory={inventory} transactions={transactions} />
            </div>
          )}

          {activeTab === 'pengaturan' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" id="tab-pengaturan">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-xs">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-display font-semibold text-slate-800">Pengaturan Toko</h2>
                    <p className="text-slate-500 text-sm">Kelola profil warung dan parameter sistem lokal Anda.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Pemilik / Juragan</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="h-4.5 w-4.5" />
                        </div>
                        <input
                          type="text"
                          required
                          value={inputProfileName}
                          onChange={(e) => setInputProfileName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl text-sm font-medium transition-all text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Toko / Warung</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Store className="h-4.5 w-4.5" />
                        </div>
                        <input
                          type="text"
                          required
                          value={inputShopName}
                          onChange={(e) => setInputShopName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl text-sm font-medium transition-all text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start pt-2">
                    <button
                      type="submit"
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      <span>Simpan Perubahan Profil</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Zona Bahaya / Danger Zone */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-rose-900 font-display">Zona Bahaya (Tindakan Sensitif)</h3>
                    <p className="text-rose-700 text-xs mt-1 leading-relaxed">
                      Hati-hati, tindakan di bawah ini tidak dapat dibatalkan. Pastikan data penting Anda sudah diamankan sebelum dikosongkan.
                    </p>

                    <div className="mt-6 flex flex-col sm:flex-row gap-4">
                      <button
                        type="button"
                        onClick={handleResetData}
                        disabled={isResetting}
                        className="px-4 py-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="h-4 w-4 shrink-0" />
                        <span>Kosongkan Riwayat Transaksi & Stok</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetAllTotal}
                        disabled={isResetting}
                        className="px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-sm shadow-rose-100"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span>Hapus Semua Data & Profil (Reset Total)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-6 text-center text-slate-400 text-xs mt-auto bg-white">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-semibold text-slate-500">
              &copy; 2026 SobatWarung. Pembukuan Pintar dengan Suara & AI.
            </p>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              <span>Data Tersimpan Aman di IndexedDB Browser Anda</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
