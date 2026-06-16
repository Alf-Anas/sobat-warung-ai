/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { InventoryItem, Transaction } from '../types';
import {
  Sparkles,
  Copy,
  Download,
  Share2,
  RefreshCw,
  ShoppingBag,
  Instagram,
  Facebook,
  Check,
  Percent,
  Warehouse,
  MessageCircle
} from 'lucide-react';

interface SocialMediaGeneratorProps {
  inventory: InventoryItem[];
  transactions: Transaction[];
}

export default function SocialMediaGenerator({ inventory, transactions }: SocialMediaGeneratorProps) {
  const [selectedItemName, setSelectedItemName] = useState('');
  const [postType, setPostType] = useState<'restock' | 'promo' | 'slow_sell'>('restock');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-fill first inventory item on mount
  useEffect(() => {
    if (inventory.length > 0 && !selectedItemName) {
      setSelectedItemName(inventory[0].itemName);
    }
  }, [inventory, selectedItemName]);

  const selectedItem = inventory.find((i) => i.itemName === selectedItemName);

  const handleGenerate = async () => {
    if (!selectedItemName) {
      setErrorMsg('Silakan pilih barang dagangan terlebih dahulu.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');
    setCaption('');
    setImageUrl('');

    try {
      const res = await fetch('/api/social-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: selectedItemName,
          type: postType,
          averageCost: selectedItem?.averageCost || 0,
          sellingPrice: selectedItem?.targetSellingPrice || (selectedItem ? Math.round(selectedItem.averageCost * 1.2) : 0),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCaption(data.caption);
        setImageUrl(data.imageUrl);
      } else {
        setErrorMsg(data.error || 'Gagal menghasilkan konten promosi medsos.');
      }
    } catch (err) {
      setErrorMsg('Gagal menghubungkan ke server.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `SobatWarung_Promosi_${selectedItemName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!imageUrl) return;
    try {
      if (navigator.share) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'promosi.png', { type: 'image/png' });
        
        await navigator.share({
          title: 'Promosi Toko SobatWarung AI',
          text: caption || `Ayo belia ${selectedItemName} berkualitas di Toko kami!`,
          files: [file],
        });
      } else {
        copyToClipboard();
        alert('Teks caption berhasil disalin! Silakan pasang postingan di media sosial Anda.');
      }
    } catch (err) {
      console.error('Error sharing:', err);
      // Fallback
      copyToClipboard();
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-205/40 p-8 relative overflow-hidden" id="social-media-panel">
      {/* Visual Indicator strip */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-lg text-slate-800">Pembuat Gambar & Caption Sosmed</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-100 text-pink-800 animate-pulse">Pemasaran AI</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Buat poster digital 1:1 dan copywriting promosi e-commerce sekali klik</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Setup controls */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Post category choosing card */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                1. Pilih Barang Dagangan:
              </label>
              <select
                value={selectedItemName}
                onChange={(e) => setSelectedItemName(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-705 focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold cursor-pointer"
              >
                {inventory.length === 0 ? (
                  <option value="">-- Stok Gudang Masih Kosong --</option>
                ) : (
                  inventory.map((item, index) => (
                    <option key={index} value={item.itemName}>
                      {item.itemName} (Stok: {item.stock} {item.unit})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                2. Pilih Tema / Tipe Promosi:
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPostType('restock')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    postType === 'restock'
                      ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm font-bold scale-102'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Warehouse className="h-4 w-4 mb-1" />
                  <span className="text-[10px] leading-tight">Baru Restok</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPostType('promo')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    postType === 'promo'
                      ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm font-bold scale-102'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Percent className="h-4 w-4 mb-1" />
                  <span className="text-[10px] leading-tight">Promo Diskon</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPostType('slow_sell')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    postType === 'slow_sell'
                      ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm font-bold scale-102'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <ShoppingBag className="h-4 w-4 mb-1" />
                  <span className="text-[10px] leading-tight">Cuci Gudang</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick item values info card */}
          {selectedItem && (
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2.5 text-xs text-slate-600">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Detail Finansial Produk:</p>
              <div className="flex justify-between">
                <span>Harga Modal Pokok:</span>
                <span className="font-mono font-bold text-slate-700">Rp {selectedItem.averageCost.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Rencana Harga Jual:</span>
                <span className="font-mono font-bold text-emerald-600">
                  Rp {(selectedItem.targetSellingPrice || Math.round(selectedItem.averageCost * 1.2)).toLocaleString('id-ID')}
                </span>
              </div>
              {selectedItem.maxDiscount !== undefined && (
                <div className="flex justify-between text-rose-600">
                  <span>Maksimal Diskon Aman:</span>
                  <span className="font-mono font-bold">Rp {selectedItem.maxDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          )}

          {/* Generate Trigger */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedItemName}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:scale-101 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-pink-700/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>AI Sedang Melukis Poster & Tulisan...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Jadikan Desain & Caption AI</span>
              </>
            )}
          </button>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

        </div>

        {/* Right column: Results Visualization (Live Mockup) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl text-slate-100 flex-1 flex flex-col">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-4">Pratinjau Postingan Media Sosial</span>
            
            {isGenerating ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-medium">Asisten SobatWarung sedang melukis gambar ilustrasi indah...</p>
              </div>
            ) : !caption && !imageUrl ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center text-center text-slate-500 gap-2">
                <Instagram className="h-10 w-10 text-slate-600" />
                <p className="text-xs font-medium">Belum ada konten e-commerce yang digenerate.</p>
                <p className="text-[10.5px] text-slate-600 max-w-xs">Silakan pilih produk di kiri lalu ketuk "Jadikan Desain & Caption AI"</p>
              </div>
            ) : (
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                
                {/* Visual Image Grid Mockup */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  
                  {/* Aspect Ratio 1:1 Image */}
                  <div className="md:col-span-6 flex justify-center">
                    <div className="relative aspect-square w-full max-w-[240px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt="AI generated promotion visual"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      
                      {/* Logo asset Overlay badge */}
                      <div className="absolute top-2 left-2 bg-black/75 px-2 py-1 rounded text-[8px] font-bold text-white tracking-widest uppercase border border-white/10">
                        SobatWarung AI
                      </div>
                    </div>
                  </div>

                  {/* Caption box */}
                  <div className="md:col-span-6 flex flex-col h-full justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Caption Tercipta:</div>
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 max-h-[180px] overflow-y-auto text-xs text-slate-300 font-medium whitespace-pre-wrap leading-relaxed select-all">
                        {caption}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3.5">
                      <button
                        onClick={copyToClipboard}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-all font-bold cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Salin Berhasil</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Salin Teks</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDownload}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        title="Download Gambar"
                      >
                        <Download className="h-4.5 w-4.5" />
                      </button>
                    </div>

                  </div>

                </div>

                {/* Bottom instant sharing action bar */}
                <div className="border-t border-slate-800/80 pt-4 mt-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">Silakan Share Promosi Ini:</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        copyToClipboard();
                        window.open('https://www.instagram.com', '_blank');
                      }}
                      className="px-3 py-2 bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 hover:scale-102 rounded-xl text-[10.5px] font-bold select-none text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Instagram className="h-4 w-4" />
                      <span>Instagram</span>
                    </button>

                    <button
                      onClick={() => {
                        copyToClipboard();
                        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(caption), '_blank');
                      }}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 hover:scale-102 rounded-xl text-[10.5px] font-bold select-none text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={handleShare}
                      className="px-3 py-2 bg-slate-705 hover:bg-slate-650 hover:scale-102 rounded-xl text-[10.5px] font-bold select-none text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md border border-slate-700"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>Semua ...</span>
                    </button>
                  </div>

                  <p className="text-[9px] text-slate-500 italic text-center mt-3 leading-relaxed">
                    *Tip: Tombol sosmed otomatis menyalin caption. Tinggal paste dan upload gambar yang telah didownload!
                  </p>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
