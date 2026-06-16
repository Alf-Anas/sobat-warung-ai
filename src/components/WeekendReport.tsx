/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WeeklySummary, Transaction, InventoryItem } from '../types';
import { Sparkles, Play, Square, Loader2, Volume2, TrendingUp, HelpCircle, AlertTriangle, Lightbulb, Bookmark } from 'lucide-react';

interface WeekendReportProps {
  transactions: Transaction[];
  inventory: InventoryItem[];
}

export default function WeekendReport({ transactions, inventory }: WeekendReportProps) {
  const [report, setReport] = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ttsEngine, setTtsEngine] = useState<'gemini' | 'browser'>('browser');
  const [speechInstance, setSpeechInstance] = useState<SpeechSynthesisUtterance | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Stop sound if component unmounts
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const generateReport = async () => {
    setIsLoading(true);
    setReport(null);
    setErrorMsg('');
    stopAudio();

    try {
      const response = await fetch('/api/weekly-report');
      const data = await response.json();

      if (response.ok) {
        setReport(data);
      } else {
        setErrorMsg(data.error || 'Gagal menerbitkan laporan mingguan.');
      }
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server untuk membuat laporan.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const playTTSGemini = async (textToSpeak: string) => {
    try {
      setErrorMsg('');
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak }),
      });

      const data = await response.json();
      if (response.ok && data.audio) {
        // Decode base64 to Blob URL for native HTML5 Audio element
        const binary = atob(data.audio);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Gemini TTS typically returns raw PCM or audio/wav. Let's create a Blob.
        // We'll fallback to a wav mime type.
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setErrorMsg('Kesalahan format audio Google, mencobakan alternatif lokal...');
          playTTSBrowser(textToSpeak); // Auto-fallback
        };

        setAudioElement(audio);
        audio.play();
      } else {
        setErrorMsg(data.error || 'TTS Google gagal. Menggunakan suara cadangan lokal...');
        playTTSBrowser(textToSpeak);
      }
    } catch (err) {
      console.error('Gemini TTS error, falling back', err);
      playTTSBrowser(textToSpeak);
    }
  };

  const playTTSBrowser = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) {
      setErrorMsg('Browser Anda tidak mendukung output suara.');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'id-ID'; // Indonesian voice
    utterance.rate = 1.0; // natural pacing
    utterance.pitch = 1.0;

    // Attach callbacks
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (e) => {
      console.error('SpeechSynthesis error:', e);
      setIsPlaying(false);
    };

    setSpeechInstance(utterance);
    window.speechSynthesis.speak(utterance);
  };

  const startAudio = () => {
    if (!report) return;

    // Clean any running speaker
    stopAudio();

    if (ttsEngine === 'gemini') {
      playTTSGemini(report.text);
    } else {
      playTTSBrowser(report.text);
    }
  };

  const stopAudio = () => {
    // Stop local speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Stop Gemini Audio Element
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      setAudioElement(null);
    }
    setIsPlaying(false);
  };

  // Quick stats computed directly
  const totalSales = transactions
    .filter((tx) => tx.type === 'penjualan')
    .reduce((acc, tx) => acc + tx.nominal, 0);

  const totalProfits = transactions
    .filter((tx) => tx.type === 'penjualan')
    .reduce((acc, tx) => acc + (tx.nominal - tx.modal), 0);

  return (
    <div className="bg-indigo-900 rounded-[32px] text-white p-8 relative overflow-hidden shadow-xl" id="weekend-report-panel">
      {/* Decorative ambient glowing circles identical to design HTML */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-800 rounded-full opacity-50 blur-xl pointer-events-none" />
      <div className="absolute left-1/4 bottom-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-indigo-800/40">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-300 animate-pulse" />
            <h2 className="font-display font-bold text-lg text-slate-100">Kabar Warung & Laporan AI</h2>
          </div>
          <p className="text-xs text-indigo-200/80 mt-0.5">Sapaan evaluasi naratif suara & tips cuan berkala</p>
        </div>

        <button
          onClick={generateReport}
          disabled={isLoading}
          className="px-4 py-2.5 bg-white text-indigo-900 font-bold text-xs rounded-xl hover:bg-indigo-50 transition-all shadow-lg self-start cursor-pointer group inline-flex items-center gap-1.5"
          id="btn-generate-weekly-report"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Menyusun Laporan...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 group-hover:rotate-12 transition-transform" />
              <span>Dapatkan Laporan AI</span>
            </>
          )}
        </button>
      </div>

      {/* Report Feed */}
      <div className="relative z-10 mt-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="h-8 w-8 text-indigo-300 animate-spin mb-3" />
            <p className="text-sm font-semibold text-indigo-100">AI sedang meneliti laporan pembukuan Anda...</p>
            <p className="text-xs text-indigo-300 mt-1 max-w-sm">
              "Merangkum seluruh nominal omset, menghitung sisa modal produk, dan merakit kalimat saran terbaik."
            </p>
          </div>
        )}

        {!isLoading && !report && (
          <div className="py-8 text-center bg-indigo-950/40 rounded-2xl border border-indigo-800/30 p-5">
            <Bookmark className="h-8 w-8 text-indigo-300/60 mx-auto mb-2.5" />
            <p className="text-sm font-bold text-slate-200">Rangkuman Suara Siap Diterbitkan</p>
            <p className="text-xs text-indigo-200/70 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Klik tombol <strong className="text-indigo-300">Dapatkan Laporan AI</strong> di atas untuk memperoleh rangkuman naratif suara warung Anda yang hangat beserta target mingguan.
            </p>
          </div>
        )}

        {!isLoading && report && (
          <div className="space-y-6 animate-fade-in">
            {/* Audio narration block */}
            <div className="bg-indigo-950/50 border border-indigo-800/40 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 bg-indigo-950/60 p-2 text-xs rounded-lg border border-indigo-900/60">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                    Laporan Narasi Suara
                  </span>
                </div>

                {/* Voice Engine Toggle */}
                <div className="flex items-center bg-indigo-900/65 p-1 rounded-md text-[10px] font-bold text-indigo-300">
                  <button
                    onClick={() => {
                      stopAudio();
                      setTtsEngine('browser');
                    }}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      ttsEngine === 'browser' ? 'bg-indigo-600 text-white shadow-sm' : ''
                    }`}
                  >
                    Suara Cepat
                  </button>
                  <button
                    onClick={() => {
                      stopAudio();
                      setTtsEngine('gemini');
                    }}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      ttsEngine === 'gemini' ? 'bg-indigo-600 text-white shadow-sm' : ''
                    }`}
                  >
                    AI Google
                  </button>
                </div>
              </div>

              {/* Text paragraph */}
              <blockquote className="text-sm italic font-medium leading-relaxed text-indigo-100 border-l-2 border-indigo-400 pl-4 mb-5">
                "{report.text}"
              </blockquote>

              {/* Player Controls */}
              <div className="flex items-center justify-between gap-4 pt-3 border-t border-indigo-900/40">
                <div className="flex items-center gap-2">
                  {isPlaying ? (
                    <button
                      onClick={stopAudio}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      id="stop-narrative-btn"
                    >
                      <Square className="h-3.5 w-3.5" />
                      <span>Hentikan</span>
                    </button>
                  ) : (
                    <button
                      onClick={startAudio}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      id="play-narrative-btn"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Dengar Rangkuman</span>
                    </button>
                  )}

                  {isPlaying && (
                    <div className="flex items-center gap-0.5 ml-2">
                      <span className="w-0.5 bg-emerald-400 h-1 rounded-sm animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 bg-emerald-400 h-3 rounded-sm animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 bg-emerald-400 h-2 rounded-sm animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="w-0.5 bg-emerald-400 h-4 rounded-sm animate-bounce" style={{ animationDelay: '450ms' }} />
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-indigo-300">
                  {ttsEngine === 'gemini' ? 'Gemini TTS Engine' : 'Web Browser TTS'}
                </div>
              </div>
            </div>

            {/* Stats highlighted row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Pencapaian Utama</span>
                </div>
                <div className="text-base font-bold text-slate-100 font-display">
                  {report.achievement || 'Laba Bersih Naik!'}
                </div>
                <p className="text-[11px] text-slate-350 mt-1">
                  Omset keseluruhan terkumpul sebanyak <strong className="text-emerald-400">Rp {totalSales.toLocaleString('id-ID')}</strong> dengan total margin sehat.
                </p>
              </div>

              <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mb-2">
                  <Lightbulb className="h-4 w-4" />
                  <span>Tips Pengembangan Biasa</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-200">
                  {report.tips || 'Maksimalkan peletakan barang laris manis di rak luar.'}
                </p>
              </div>
            </div>

            {/* Warehouse Warnings */}
            {report.outOfStockOrLow && report.outOfStockOrLow.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">Peringatan Penting Sisa Stok:</h4>
                  <ul className="list-disc list-inside text-[11px] text-amber-200/90 mt-1 space-y-0.5">
                    {report.outOfStockOrLow.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global errors display */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/25 text-rose-200 rounded-xl text-xs font-semibold mt-4">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
