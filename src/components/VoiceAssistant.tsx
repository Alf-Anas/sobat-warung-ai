/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Send,
  Check,
  CornerDownRight,
  HelpCircle,
  Keyboard,
  Plus,
  Trash2,
  FileText,
  Printer,
  ShoppingBag,
  Info,
  DollarSign,
  Briefcase,
  X
} from 'lucide-react';
import { ParsedTransactionResult, InventoryItem } from '../types';

interface VoiceAssistantProps {
  onTransactionAdded: () => void;
  inventory?: InventoryItem[];
}

interface CartItem {
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  nominal: number;
  modal: number;
  notes: string;
}

// Quick presets representing Indonesian merchant slang
const RECOGNITION_PRESETS = [
  { label: 'Penjualan Sembako', text: 'Barusan laku sembako 3 pak total 45 ribu, modalnya 35 ribu.' },
  { label: 'Stok Minyak Goreng', text: 'Masuk stok minyak goreng baru 2 kardus, beli dari agen 240 ribu.' },
  { label: 'Penjualan Beras', text: 'Beras raja lele laku bungkusan 10 kilo dapet uang seratus lima puluh ribu rupiah, harga belinya seratus duapuluh ribu.' },
  { label: 'Eceran Indomie', text: 'Laku mie instant indomie goreng lima bungkus dapet uang 17.500 rupiah.' },
];

export default function VoiceAssistant({ onTransactionAdded, inventory = [] }: VoiceAssistantProps) {
  // Input Mode: 'voice' or 'manual'
  const [inputMode, setInputMode] = useState<'voice' | 'manual'>('voice');

  // --- Voice Mode States ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [customText, setCustomText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedTransactionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);

  // Manual editing fields for Confirmation Dialog
  const [editItemName, setEditItemName] = useState('');
  const [editCategory, setEditCategory] = useState('Lainnya');
  const [editType, setEditType] = useState<'penjualan' | 'pembelian_stok'>('penjualan');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editUnit, setEditUnit] = useState('pcs');
  const [editNominal, setEditNominal] = useState(0);
  const [editModal, setEditModal] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  // --- Manual/Cart Mode States ---
  const [manualType, setManualType] = useState<'penjualan' | 'pembelian_stok'>('penjualan');
  const [manualGeneralNotes, setManualGeneralNotes] = useState('');
  
  // Single item entry states
  const [manualItemName, setManualItemName] = useState('');
  const [manualCategory, setManualCategory] = useState('Sembako');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualUnit, setManualUnit] = useState('pcs');
  const [manualNominal, setManualNominal] = useState(0); // Price total or per-item (we ask total)
  const [manualModal, setManualModal] = useState(0);
  const [manualNotes, setManualNotes] = useState('');

  // Group transaction items container
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceGroupId, setInvoiceGroupId] = useState('');

  const recognitionRef = useRef<any>(null);

  // Auto-fill from inventory selector
  const handleInventorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedItemName = e.target.value;
    if (!selectedItemName) return;

    const matched = inventory.find(item => item.itemName === selectedItemName);
    if (matched) {
      setManualItemName(matched.itemName);
      setManualCategory(matched.category);
      setManualUnit(matched.unit || 'pcs');
      setManualModal(matched.averageCost);
      // Autofill nominal using suggestions
      setManualNominal(matched.targetSellingPrice || Math.round(matched.averageCost * 1.2));
    }
  };

  useEffect(() => {
    // Check Speech Recognition Web API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'id-ID'; // Indonesian locale dictation

    rec.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorMsg('Izin mikrofon ditolak. Silakan aktifkan izin mikrofon Anda.');
      } else {
        setErrorMsg(`Gagal merekam suara: ${event.error}`);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  const toggleListening = () => {
    if (!voiceSupported) {
      setErrorMsg('Browser Anda tidak mendukung perekaman suara langsung. Silakan gunakan tombol ketik.');
      return;
    }

    setErrorMsg('');
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setParsedResult(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err: any) {
        console.error('Start recognition failed', err);
        setIsListening(false);
      }
    }
  };

  const handleTextSubmit = async (inputText: string) => {
    if (!inputText.trim()) {
      setErrorMsg('Masukkan teks atau rekam suara Anda terlebih dahulu.');
      return;
    }

    setErrorMsg('');
    setIsParsing(true);
    setParsedResult(null);

    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();
      if (response.ok) {
        setParsedResult(data);
        // Pre-fill manual editor form with recommendation
        setEditItemName(data.itemName || '');
        setEditCategory(data.category || 'Lainnya');
        setEditType((data.transactionType === 'pembelian_stok' ? 'pembelian_stok' : 'penjualan'));
        setEditQuantity(data.quantity || 1);
        setEditUnit(data.unit || 'pcs');
        setEditNominal(data.nominal || 0);
        setEditModal(data.modal || 0);
        setEditNotes('');
      } else {
        setErrorMsg(data.error || 'Gagal memproses suara Anda dengan AI.');
      }
    } catch (err: any) {
      setErrorMsg('Gagal terhubung ke server untuk memproses AI.');
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!editItemName.trim()) {
      setErrorMsg('Nama barang wajib diisi!');
      return;
    }

    try {
      const response = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editType,
          category: editCategory,
          itemName: editItemName,
          quantity: editQuantity,
          unit: editUnit,
          nominal: editNominal,
          modal: editModal,
          rawText: transcript || customText || 'Input suara/teks',
          notes: editNotes || 'Disinkron via Suara AI'
        }),
      });

      if (response.ok) {
        // Success cleanup
        setParsedResult(null);
        setTranscript('');
        setCustomText('');
        setEditNotes('');
        onTransactionAdded();
      } else {
        const data = await response.json();
        setErrorMsg(data.error || 'Gagal menyimpan transaksi.');
      }
    } catch (err) {
      setErrorMsg('Gagal menghubungi server untuk menyimpan data.');
      console.error(err);
    }
  };

  const sendActiveText = () => {
    const activeText = transcript || customText;
    handleTextSubmit(activeText);
  };


  // --- Manual Mode Functions ---
  const handleAddCartItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualItemName.trim()) {
      setErrorMsg('Silakan tulis nama barang atau pilih barang dari gudang.');
      return;
    }

    if (manualQuantity <= 0) {
      setErrorMsg('Kuantitas item harus minimal 1.');
      return;
    }

    // Multiply if manual nominal price was inputted as price-per-unit, or treat as total.
    // We treat it as total price as requested.
    const newItem: CartItem = {
      itemName: manualItemName,
      category: manualCategory,
      quantity: Number(manualQuantity),
      unit: manualUnit || 'pcs',
      nominal: Number(manualNominal),
      modal: Number(manualModal) * Number(manualQuantity), // Average Cost * Quantity
      notes: manualNotes,
    };

    setCartItems([...cartItems, newItem]);
    setErrorMsg('');

    // Reset single item fields
    setManualItemName('');
    setManualQuantity(1);
    setManualNominal(0);
    setManualNotes('');
  };

  const removeCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, idx) => idx !== index));
  };

  const handleSaveWholeGroup = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('Keranjang kosong! Tambahkan minimal 1 item terlebih dahulu.');
      return;
    }

    setIsSavingManual(true);
    setErrorMsg('');

    // Shared Group Transaction ID
    const generatedGroupId = `group-${Date.now()}`;

    try {
      // Send each transaction one by one in parallel or sequence
      const promises = cartItems.map((item) => {
        return fetch('/api/transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: manualType,
            category: item.category,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            nominal: item.nominal,
            modal: item.modal,
            rawText: `Grup Transaksi manual: ${generatedGroupId}`,
            notes: item.notes || manualGeneralNotes || 'Pembelian grup barang',
            groupId: generatedGroupId,
          }),
        });
      });

      const results = await Promise.all(promises);
      const allOk = results.every(res => res.ok);

      if (allOk) {
        setInvoiceGroupId(generatedGroupId);
        onTransactionAdded();
        
        // Show Invoice preview dialog for convenient PDF printing
        setShowInvoiceModal(true);
        setCartItems([]);
        setManualGeneralNotes('');
      } else {
        setErrorMsg('Beberapa item gagal disimpan ke database.');
      }
    } catch (err) {
      setErrorMsg('Gagal menyinkronkan grup transaksi ke server.');
      console.error(err);
    } finally {
      setIsSavingManual(false);
    }
  };

  const triggerPrintInvoice = () => {
    window.print();
  };

  // Quick calculations for display
  const totalCartNominal = cartItems.reduce((sum, item) => sum + item.nominal, 0);
  const totalCartModal = cartItems.reduce((sum, item) => sum + item.modal, 0);
  const estLabaCart = manualType === 'penjualan' ? (totalCartNominal - totalCartModal) : 0;

  return (
    <div className="space-y-6">
      {/* Choice Selector Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl max-w-sm" id="input-mode-selector">
        <button
          onClick={() => {
            setInputMode('voice');
            setErrorMsg('');
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            inputMode === 'voice'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mic className="h-4 w-4" />
          <span>Asisten Suara AI</span>
        </button>

        <button
          onClick={() => {
            setInputMode('manual');
            setErrorMsg('');
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            inputMode === 'manual'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Keyboard className="h-4 w-4" />
          <span>Formulir Manual & Invoice</span>
        </button>
      </div>

      {/* --- RENDER VOICE REGISTER TAB --- */}
      {inputMode === 'voice' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 relative overflow-hidden" id="voice-assistant-panel">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base text-slate-800">Tekan & Bicara</h2>
                <p className="text-xs text-slate-550">Letakkan di depan Anda, catat tanpa mengetik</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
              <Sparkles className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>Gemini AI</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 mb-6">
            <button
              onClick={toggleListening}
              id="toggle-mic-btn"
              className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-all duration-300 focus:outline-none cursor-pointer ring-8 ${
                isListening
                  ? 'bg-red-500 text-white shadow-xl shadow-red-200 hover:bg-red-600 scale-105 ring-red-50'
                  : 'bg-emerald-600 text-white shadow-2xl shadow-emerald-200 hover:bg-emerald-700 hover:scale-103 ring-emerald-50'
              }`}
            >
              {isListening ? (
                <>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <MicOff className="h-10 w-10 relative z-10" />
                </>
              ) : (
                <Mic className="h-10 w-10 relative z-10" />
              )}
            </button>

            <p className="text-sm font-bold mt-5 text-slate-800">
              {isListening ? 'Mendengarkan... Silakan Bicara' : 'Tekan & Katakan Transaksi Anda'}
            </p>
            <p className="text-[11.5px] text-slate-500 mt-1 text-center max-w-sm italic leading-relaxed">
              {voiceSupported
                ? '"Barusan laku sembako 3 pak total 45 ribu, modalnya 35 ribu."'
                : 'Peramban tidak mendukung input audio. Silakan ketik kalimat di bawah.'}
            </p>

            {isListening && (
              <div className="flex items-center gap-1 mt-4 h-5">
                <span className="w-1 bg-red-400 h-2 animate-bounce rounded-full duration-150" />
                <span className="w-1 bg-red-400 h-4 animate-bounce rounded-full duration-300" />
                <span className="w-1 bg-red-400 h-3 animate-bounce rounded-full duration-200" />
                <span className="w-1 bg-red-400 h-5 animate-bounce rounded-full duration-400" />
                <span className="w-1 bg-red-400 h-3 animate-bounce rounded-full duration-100" />
                <span className="w-1 bg-red-400 h-2 animate-bounce rounded-full duration-250" />
              </div>
            )}
          </div>

          {/* Transcript or Custom text */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Transkripsi / Tulisan Kalimat:
              </label>

              {isListening || transcript ? (
                <div className="min-h-16 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-slate-800 text-sm italic font-medium leading-relaxed">
                  {transcript || 'Mulai berbicara... AI sedang mendengarkan kata demi kata Anda...'}
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    placeholder="Barusan laku sembako 3 pak total 45 ribu, modalnya 35 ribu..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full text-xs min-h-18 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 focus:bg-white transition-all resize-none font-medium"
                  />
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="flex gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-100 items-start">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            <div className="flex gap-3">
              {(transcript || customText) && (
                <button
                  onClick={() => {
                    setTranscript('');
                    setCustomText('');
                    setParsedResult(null);
                    setErrorMsg('');
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Hapus Teks
                </button>
              )}

              <button
                onClick={sendActiveText}
                disabled={isParsing || isListening || (!transcript && !customText)}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/15"
                id="process-ai-btn"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>AI sedang menafsirkan arti...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Konversi Suara via AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Slang Preset list */}
          {!transcript && !customText && !parsedResult && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1 mb-2.5">
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Contoh Suara (Klik untuk Mengambil Teks):
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {RECOGNITION_PRESETS.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCustomText(preset.text);
                      setErrorMsg('');
                    }}
                    className="text-left p-2.5 bg-slate-50 hover:bg-emerald-50/50 border border-slate-150 hover:border-emerald-200 rounded-xl text-[11px] transition-all cursor-pointer group"
                  >
                    <div className="font-bold text-slate-700 group-hover:text-emerald-700 mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                      {preset.label}
                    </div>
                    <div className="text-slate-500 line-clamp-1 italic text-[10px]">"{preset.text}"</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parse Dialog */}
          {parsedResult && (
            <div className="mt-6 p-4 bg-gradient-to-br from-emerald-50/70 to-emerald-50/20 border border-emerald-100 rounded-2xl animate-fade-in" id="ai-parsed-results">
              <div className="flex items-center justify-between border-b border-emerald-100/60 pb-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <h3 className="text-sm font-bold text-emerald-950 font-display">Data Hasil Analisa AI</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Kecocokan {Math.round(parsedResult.confidenceScore * 100)}%
                </span>
              </div>

              <div className="bg-white rounded-xl border border-emerald-50 p-3.5 mb-4 text-xs shadow-xs space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Jenis Transaksi
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as any)}
                      className="w-full bg-slate-50 p-1.5 rounded-md border border-slate-200 text-xs text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold cursor-pointer"
                    >
                      <option value="penjualan">Jual (Laku)</option>
                      <option value="pembelian_stok">Beli (Restok Kulakan)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Kategori Barang
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-slate-50 p-1.5 rounded-md border border-slate-200 text-xs text-slate-750 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold cursor-pointer"
                    >
                      {['Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    Nama Barang Dagangan
                  </label>
                  <input
                    type="text"
                    value={editItemName}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 p-1.5 rounded-md border border-slate-200 focus:bg-white text-slate-800"
                    placeholder="Nama Barang"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Satuan Unit
                    </label>
                    <input
                      type="text"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full bg-slate-50 p-1.5 rounded-md border border-slate-200 text-slate-700 text-xs font-semibold"
                      placeholder="pak, kg, dll"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Jumlah Kuantitas
                    </label>
                    <input
                      type="number"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(Number(e.target.value))}
                      className="w-full bg-slate-50 p-1.5 rounded-md border border-slate-200 text-slate-700 text-xs font-semibold"
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Nilai Transaksi (Total Rp)
                    </label>
                    <input
                      type="number"
                      value={editNominal}
                      onChange={(e) => setEditNominal(Number(e.target.value))}
                      className="w-full bg-slate-50 p-1.5 rounded-md border border-slate-200 text-emerald-700 font-mono font-extrabold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                      Total Estimasi Modal (Rp)
                    </label>
                    <input
                      type="number"
                      value={editModal}
                      onChange={(e) => setEditModal(Number(e.target.value))}
                      className="w-full bg-slate-50 p-1.5 rounded-md border border-slate-200 text-slate-600 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    Catatan Transaksi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 p-1.5 rounded-md border border-slate-200 text-slate-705 placeholder-slate-400"
                    placeholder="Contoh: Pembeli minta diskon tipis, bonus bungkus..."
                  />
                </div>

                {parsedResult.explanation && (
                  <div className="flex gap-1.5 p-2.5 bg-slate-50 rounded text-slate-500 italic mt-2 text-[10px] leading-relaxed border-l-2 border-emerald-500">
                    <CornerDownRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                    <span>Asisten AI: "{parsedResult.explanation}"</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setParsedResult(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-emerald-750/15"
                  id="confirm-save-btn"
                >
                  <Check className="h-4 w-4" />
                  <span>Simpan Ke Rekaman Buku</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- RENDER MANUAL ENTRY & MULTI-ITEM CART TAB --- */}
      {inputMode === 'manual' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-205/40 p-8 relative overflow-hidden" id="manual-transaction-panel">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display font-bold text-base text-slate-800">Pembukuan Manual & Grup Transaksi</h2>
              <p className="text-xs text-slate-500">Grup beberapa item sekaligus untuk seorang customer menjadi invoice</p>
            </div>

            <div className="flex bg-slate-150 p-1 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setManualType('penjualan')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  manualType === 'penjualan'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-650 hover:text-slate-800'
                }`}
              >
                Grup Laku (Jual)
              </button>
              <button
                type="button"
                onClick={() => setManualType('pembelian_stok')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  manualType === 'pembelian_stok'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-650 hover:text-slate-800'
                }`}
              >
                Grup Kulakan (Stok)
              </button>
            </div>
          </div>

          {/* Setup Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Form to insert item to cart */}
            <form onSubmit={handleAddCartItem} className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-150">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3 flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                Tambah Barang Ke Transaksi
              </h3>

              {/* Fast Selector from existing Stock inventory */}
              {inventory.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1 flex items-center gap-1">
                    <Info className="h-3 w-3 text-emerald-500" /> Autofill Dari Gudang Stok:
                  </label>
                  <select
                    onChange={handleInventorySelect}
                    defaultValue=""
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:border-slate-350 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold cursor-pointer"
                  >
                    <option value="">-- Pilih Barang Stok untuk Prefill --</option>
                    {inventory.map((item, idx) => (
                      <option key={idx} value={item.itemName}>
                        {item.itemName} (Stok: {item.stock})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Nama Barang*
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Minyak Goreng Filma 1L"
                  value={manualItemName}
                  onChange={(e) => setManualItemName(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Kategori
                  </label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer"
                  >
                    {['Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Satuan Unit
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="pcs, kg, pak, bks"
                    value={manualUnit}
                    onChange={(e) => setManualUnit(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Jumlah (Qty)*
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Est. Modal Satuan (Rp)*
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Modal beli eceran"
                    value={manualModal}
                    onChange={(e) => setManualModal(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  {manualType === 'penjualan' ? 'Total Harga Jual Transaksi (Rp)*' : 'Total Harga Pengeluaran Kulak (Rp)*'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-[11px] font-bold text-emerald-750">Rp</span>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Nilai keseluruhan item tersebut"
                    value={manualNominal}
                    onChange={(e) => setManualNominal(Number(e.target.value))}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-extrabold text-emerald-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Catatan Item (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Diskon 2000 rupiah"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-705 placeholder-slate-400 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Tambahkan Ke Keranjang</span>
              </button>
            </form>

            {/* Compiled Cart display */}
            <div className="lg:col-span-7 flex flex-col h-full justify-between space-y-4">
              
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3.5">
                    Daftar Item Transaksi: ({cartItems.length} Produk)
                  </h3>

                  {cartItems.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-slate-450 gap-1.5">
                      <ShoppingBag className="h-8 w-8 text-slate-300" />
                      <p className="text-xs font-bold">Keranjang belanja kosong</p>
                      <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                        Gunakan form di kiri untuk menambahkan item pembelian ke asisten pencatat.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {cartItems.map((item, idx) => (
                        <div key={idx} className="bg-white p-3 border border-slate-150 rounded-xl flex items-center justify-between gap-1.5 text-xs shadow-xs">
                          <div>
                            <div className="font-bold text-slate-800">
                              {item.itemName} <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-bold">{item.quantity} {item.unit}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                              Kategori: {item.category} {item.notes && `• Note: "${item.notes}"`}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right font-mono font-bold text-emerald-800">
                              Rp {item.nominal.toLocaleString('id-ID')}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeCartItem(idx)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-450 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cartItems.length > 0 && (
                  <div className="border-t border-slate-200 pt-3.5 mt-5 space-y-3.5">
                    
                    {/* General notes for the whole group */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wide mb-1">
                        Catatan Transaksi Umum (Contoh: untuk diskon keseluruhan, catatan pembeli, dll):
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pelanggan setia dapet bonus minyak, diskon total lima ribu rupiah..."
                        value={manualGeneralNotes}
                        onChange={(e) => setManualGeneralNotes(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-705 placeholder-slate-400"
                      />
                    </div>

                    {/* Numeric cart aggregations */}
                    <div className="grid grid-cols-2 bg-white rounded-xl p-3 border border-slate-150 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-500 block">Total Nominal Nilai:</span>
                        <span className="font-mono text-base font-extrabold text-slate-900 block">
                          Rp {totalCartNominal.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {manualType === 'penjualan' && (
                        <div className="space-y-1 text-right border-l border-slate-150 pl-3">
                          <span className="text-slate-500 block">Bagian Keuntungan Bersih:</span>
                          <span className="font-mono text-base font-extrabold text-emerald-700 block">
                            +Rp {estLabaCart.toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Save & Invoice printer triggers */}
              {cartItems.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setCartItems([])}
                    disabled={isSavingManual}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Kosongkan Semua
                  </button>

                  <button
                    onClick={handleSaveWholeGroup}
                    disabled={isSavingManual}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-700/15 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingManual ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Sedang Sinkron Buku...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Simpan Transaksi & Cetak Invoice</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* --- INVOICE PREVIEW MODAL --- */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="invoice-modal-overlay">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 border border-slate-200 shadow-2xl relative overflow-y-auto max-h-[95vh]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-600"></div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <h3 className="font-display font-bold text-base text-slate-850 flex items-center gap-1.5">
                <FileText className="h-5 w-5 text-emerald-600" />
                <span>Invoice Siap Dicetak!</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Real Invoice Layout - Target of Window.print styling */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 shadow-inner font-sans space-y-4 text-xs text-slate-700" id="printable-invoice-receipt">
              <div className="flex justify-between items-start border-b border-dashed border-slate-300 pb-4">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">SobatWarung AI</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Solusi Keuangan Pintar UMKM</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                    LUNAS
                  </span>
                  <p className="text-[9px] text-slate-450 font-mono mt-1.5">Nota: #{invoiceGroupId}</p>
                </div>
              </div>

              {/* Transaction details block */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[8px] tracking-wider mb-0.5">Tanggal:</span>
                  <span className="font-medium">{new Date().toLocaleString('id-ID')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[8px] tracking-wider mb-0.5 text-right">Metode Pembayaran:</span>
                  <span className="font-medium text-right block">Tunai / Manual Ledger</span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left font-sans text-xs mt-3.5">
                <thead>
                  <tr className="border-b border-slate-250 font-bold text-slate-400 text-[9.5px] uppercase tracking-wider bg-slate-100/50">
                    <th className="py-2 px-1">Barang</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Nilai Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {/* Since database contains full entries, we read from historical context if cart cleared, 
                      or render statically from state, or mock direct preview list from saved inputs */}
                  {cartItems.length > 0 ? (
                    cartItems.map((item, idx) => (
                      <tr key={idx} className="text-slate-705">
                        <td className="py-2.5 px-1 font-bold">
                          {item.itemName}
                          {item.notes && <span className="block text-[9px] font-normal italic text-slate-450">"{item.notes}"</span>}
                        </td>
                        <td className="py-2.5 text-center">{item.quantity} {item.unit}</td>
                        <td className="py-2.5 text-right font-mono font-bold">Rp {item.nominal.toLocaleString('id-ID')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="text-slate-705">
                      <td className="py-3 px-1 font-bold" colSpan={3}>
                        Grup transaksi tersimpan dalam database dengan ID #{invoiceGroupId}.
                        <p className="font-normal text-[10.5px] text-slate-500 mt-1">
                          Lihat riwayat penuh di tab Keuangan sewaktu-waktu.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {manualGeneralNotes && (
                <div className="p-3 bg-white border border-slate-150 rounded-xl text-[10px] text-slate-650 leading-relaxed italic">
                  Note: "{manualGeneralNotes}"
                </div>
              )}

              {/* Total Summary */}
              {cartItems.length > 0 && (
                <div className="border-t border-slate-350 pt-3.5 space-y-1.5 flex flex-col items-end">
                  <div className="flex gap-4 text-[11px] text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-mono">Rp {totalCartNominal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex gap-4 text-xs font-bold text-slate-800">
                    <span>Grand Total:</span>
                    <span className="font-mono text-emerald-850">Rp {totalCartNominal.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-slate-300 pt-3 text-center">
                <p className="text-[10px] text-slate-450 font-semibold tracking-wide">Terima Kasih Telah Berbelanja Di Kedai Kami!</p>
                <p className="text-[8.5px] text-slate-400 mt-0.5">Powered by SobatWarung AI</p>
              </div>

            </div>

            {/* Footer Action items */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Kembali
              </button>

              <button
                type="button"
                onClick={triggerPrintInvoice}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
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
