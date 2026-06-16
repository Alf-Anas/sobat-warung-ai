/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction } from '../types';
import {
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Search,
  Filter,
  ShoppingBag,
  Printer,
  X,
  FileText,
  Bookmark
} from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
}

export default function TransactionList({ transactions, onDeleteTransaction }: TransactionListProps) {
  const [filterType, setFilterType] = useState<'semua' | 'penjualan' | 'pembelian_stok'>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('semua');

  // Invoice display overlay state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<Transaction[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Categories lists
  const categories = ['semua', 'Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'];

  // Filter & search implementation
  const filteredTransactions = transactions.filter((tx) => {
    const matchesType = filterType === 'semua' || tx.type === filterType;
    const matchesCategory = filterCategory === 'semua' || tx.category === filterCategory;
    const matchesSearch =
      tx.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.rawText && tx.rawText.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.groupId && tx.groupId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesType && matchesCategory && matchesSearch;
  });

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'Minyak':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Beras':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'Sembako':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Minuman':
        return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'Camilan':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Bumbu':
        return 'bg-orange-50 text-orange-700 border-orange-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  // Helper to format date lovingly
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Gather all transactions sharing the same groupId to print as unified receipt
  const startInvoicePrinting = (groupId: string) => {
    const grouped = transactions.filter((tx) => tx.groupId === groupId);
    setInvoiceItems(grouped);
    setSelectedGroupId(groupId);
    setShowInvoiceModal(true);
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 relative overflow-hidden" id="transaction-list-panel">
      {/* Decorative top strip identical to design HTML */}
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

      {/* Search and Filters Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-lg text-slate-800">Riwayat Pembukuan Warung</h2>
          <p className="text-xs text-slate-550">Log transaksi tercatat otomatis dari suara & ketikan asisten</p>
        </div>

        {/* Action Type Filters */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl self-start">
          <button
            onClick={() => setFilterType('semua')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterType === 'semua'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterType('penjualan')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'penjualan'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-550 hover:text-emerald-700'
            }`}
          >
            <ArrowUpRight className="h-3 w-3" />
            <span>Laku (Jual)</span>
          </button>
          <button
            onClick={() => setFilterType('pembelian_stok')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'pembelian_stok'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-550 hover:text-rose-700'
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5" />
            <span>Kulakan (Stok)</span>
          </button>
        </div>
      </div>

      {/* Query Filter row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari barang, catatan, grup nota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700 transition-all font-medium"
          />
        </div>

        {/* Category Choice */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'semua' ? 'Semua Kategori' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feed list */}
      <div className="overflow-x-auto">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-205 rounded-2xl bg-slate-50/20">
            <ShoppingBag className="h-8 w-8 text-slate-350 mb-2.5" />
            <p className="text-sm font-bold text-slate-700">Belum Ada Transaksi Ditemukan</p>
            <p className="text-xs text-slate-450 mt-1 max-w-xs leading-relaxed">
              Silakan tekan tombol Rekam Suara atau gunakan pengisian manual untuk memulai pembukuan warung Anda.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-2">Nama Barang</th>
                <th className="py-3 px-2">Kategori</th>
                <th className="py-3 px-2 text-right">Nilai Total</th>
                <th className="py-3 px-2 text-right">Laba / Rugi</th>
                <th className="py-3 px-2 text-center">Waktu</th>
                <th className="py-3 px-2 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const isSale = tx.type === 'penjualan';
                const profit = isSale ? tx.nominal - tx.modal : 0;
                const profitPercent = isSale && tx.nominal > 0 ? (profit / tx.nominal) * 100 : 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 text-xs text-slate-705 transition-colors" id={`tx-row-${tx.id}`}>
                    {/* Item Details */}
                    <td className="py-4 px-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isSale ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {isSale ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{tx.itemName}</span>
                            <span className="text-[9.5px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-bold">
                              {tx.quantity} {tx.unit}
                            </span>
                          </div>
                          
                          {/* Display optional individual notes */}
                          {tx.notes && (
                            <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-0.5 mt-0.5">
                              <Bookmark className="h-2.5 w-2.5" />
                              <span>"{tx.notes}"</span>
                            </div>
                          )}

                          {tx.rawText && !tx.rawText.startsWith('Grup Transaksi manual') && (
                            <div className="text-[10px] text-slate-450 italic line-clamp-1 mt-0.5 max-w-[200px]" title={tx.rawText}>
                              "{tx.rawText}"
                            </div>
                          )}

                          {/* Group transaction identifier badge */}
                          {tx.groupId && (
                            <button
                              onClick={() => startInvoicePrinting(tx.groupId!)}
                              className="text-[9.5px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded px-1.5 py-0.5 mt-1 hover:bg-indigo-100 transition-all flex items-center gap-0.5"
                              title="Tampilkan invoice grup barang ini"
                            >
                              <Printer className="h-2.5 w-2.5" />
                              <span>Nota: #{tx.groupId.replace('group-', '')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeColor(tx.category)}`}>
                        {tx.category || 'Lainnya'}
                      </span>
                    </td>

                    {/* Nominal */}
                    <td className="py-4 px-2 text-right font-mono font-bold text-slate-800 font-medium">
                      <span className={isSale ? 'text-emerald-600 font-extrabold' : 'text-slate-700'}>
                        {isSale ? '+' : '-'} Rp {tx.nominal.toLocaleString('id-ID')}
                      </span>
                    </td>

                    {/* Profit/COGS */}
                    <td className="py-4 px-2 text-right">
                      {isSale ? (
                        <div>
                          <div className="font-mono text-[11.5px] font-extrabold text-emerald-700">
                            +Rp {profit.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[9px] text-emerald-600 font-bold tracking-tight">
                            Margin {Math.round(profitPercent)}%
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">
                          modal kulak
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-4 px-2 text-center text-[10.5px] font-medium text-slate-500 whitespace-nowrap">
                      {formatDate(tx.timestamp)}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-2 text-center">
                      <div className="flex justify-center items-center gap-1">
                        {tx.groupId && (
                          <button
                            onClick={() => startInvoicePrinting(tx.groupId!)}
                            className="p-1 px-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="Print Invoice"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            if (confirm('Hapus transaksi ini? Stok barang di gudang akan disesuaikan kembali.')) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="p-1 px-1.5 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Transaksi"
                          id={`delete-tx-btn-${tx.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* --- RENDER PRINT CORRESPONDING INVOICE MODAL --- */}
      {showInvoiceModal && selectedGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="invoice-details-overlay">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 border border-slate-200 shadow-2xl relative overflow-y-auto max-h-[95vh]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600"></div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Salinan Invoice / Nota Pembelian</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Frame */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 shadow-inner font-sans space-y-4 text-xs text-slate-755" id="printable-invoice-receipt">
              <div className="flex justify-between items-start border-b border-dashed border-slate-350 pb-4">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-850 tracking-tight">SobatWarung AI</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">Pendamping Keuangan & Pemasaran UMKM</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] bg-green-150 text-emerald-850 border border-emerald-100 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                    TERBAYAR
                  </span>
                  <p className="text-[9px] text-slate-500 font-mono mt-1">Nota: #{selectedGroupId.replace('group-', '')}</p>
                </div>
              </div>

              {/* Time reference */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[8px] tracking-wider">Waktu Nota:</span>
                  <span className="font-semibold text-slate-705">
                    {invoiceItems.length > 0 ? formatDate(invoiceItems[0].timestamp) : new Date().toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items tabular rows */}
              <table className="w-full text-left font-sans text-xs mt-3">
                <thead>
                  <tr className="border-b border-slate-250 font-bold text-slate-450 text-[9px] uppercase tracking-wider bg-slate-100">
                    <th className="py-2 px-1">Deskripsi Barang</th>
                    <th className="py-2 text-center">Jumlah</th>
                    <th className="py-2 text-right">Total (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {invoiceItems.map((item) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-2.5 px-1 font-bold">
                        {item.itemName}
                        {item.notes && <span className="block text-[9px] font-normal italic text-slate-500">"{item.notes}"</span>}
                      </td>
                      <td className="py-2.5 text-center">{item.quantity} {item.unit}</td>
                      <td className="py-2.5 text-right font-mono font-bold">Rp {item.nominal.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total display */}
              <div className="border-t border-slate-350 pt-3 flex flex-col items-end">
                <div className="flex gap-4 font-extrabold text-sm text-slate-800">
                  <span>Grand Total Tagihan:</span>
                  <span className="font-mono text-emerald-700">
                    Rp {invoiceItems.reduce((acc, row) => acc + row.nominal, 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-3 text-center">
                <p className="text-[9.5px] text-slate-450 font-bold">Terima Kasih Telah Berbelanja Di Tempat Kami!</p>
                <p className="text-[8px] text-slate-400 mt-0.5">Solusi Pembukuan Digital Mandiri - SobatWarung AI</p>
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4.5 w-4.5" />
                <span>Cetak Nota / Save PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
