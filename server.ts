/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to call generateContent with automatic model fallback (e.g., on 429 quota limits or server errors)
async function generateWithFallback(params: {
  contents: any;
  config?: any;
  model: string;
}, fallbackModels: string[] = []): Promise<any> {
  const models = [params.model, ...fallbackModels];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Gemini SDK] Attempting generation with model: ${model}`);
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      console.log(`[Gemini SDK] Success with model: ${model}`);
      return response;
    } catch (err: any) {
      console.warn(`[Gemini SDK] Model ${model} failed:`, err.message || err);
      lastError = err;
      // Continue to next model in the list
    }
  }

  throw lastError || new Error('All models in fallback chain failed');
}

const DB_PATH = path.join(process.cwd(), 'src', 'db.json');

// Helper to load db
async function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = await fs.promises.readFile(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading DB:', error);
  }
  // Safe fallback to default data
  return {
    transactions: [],
    inventory: [],
  };
}

// Helper to write db
async function writeDB(data: any) {
  try {
    await fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing DB:', error);
    return false;
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Get all transactions and current inventory
app.get('/api/data', async (req, res) => {
  const db = await readDB();
  res.json(db);
});

// Create/add/mock transaction manually or directly
app.post('/api/transaction', async (req, res) => {
  try {
    const { type, category, itemName, quantity, unit, nominal, modal, rawText, notes, groupId } = req.body;

    if (!type || !itemName || !quantity) {
      return res.status(400).json({ error: 'Data transaksi tidak lengkap' });
    }

    const db = await readDB();
    const newTx = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      type,
      category: category || 'Lainnya',
      itemName,
      quantity: Number(quantity),
      unit: unit || 'pcs',
      nominal: Number(nominal || 0),
      modal: Number(modal || 0),
      rawText: rawText || 'Diinput manual',
      notes: notes || '',
      groupId: groupId || null,
    };

    db.transactions.unshift(newTx); // Add to beginning of log

    // Process inventory levels automatically
    let invItem = db.inventory.find(
      (item: any) => item.itemName.toLowerCase() === itemName.toLowerCase()
    );

    if (type === 'penjualan') {
      if (invItem) {
        invItem.stock = Math.max(0, invItem.stock - Number(quantity));
        invItem.lastUpdated = newTx.timestamp;
      } else {
        // Build new dynamic inventory item
        db.inventory.push({
          itemName,
          category: category || 'Lainnya',
          stock: 0, // initially sold without stocking up
          unit: unit || 'pcs',
          averageCost: Math.round(Number(modal || 0) / Number(quantity)),
          lastUpdated: newTx.timestamp,
        });
      }
    } else if (type === 'pembelian_stok') {
      if (invItem) {
        const totalPreviousCost = invItem.stock * invItem.averageCost;
        const totalNewCost = Number(nominal);
        const totalNewQuantity = invItem.stock + Number(quantity);

        invItem.stock = totalNewQuantity;
        // Compute new weighted average cost
        if (totalNewQuantity > 0) {
          invItem.averageCost = Math.round((totalPreviousCost + totalNewCost) / totalNewQuantity);
        }
        invItem.lastUpdated = newTx.timestamp;
      } else {
        db.inventory.push({
          itemName,
          category: category || 'Lainnya',
          stock: Number(quantity),
          unit: unit || 'pcs',
          averageCost: Math.round(Number(nominal) / Number(quantity)),
          lastUpdated: newTx.timestamp,
        });
      }
    }

    await writeDB(db);
    res.json({ success: true, transaction: newTx, inventory: db.inventory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a transaction and rollback stock
app.delete('/api/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readDB();
    const txIndex = db.transactions.findIndex((tx: any) => tx.id === id);

    if (txIndex === -1) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const tx = db.transactions[txIndex];
    // Rollback inventory impact
    const invItem = db.inventory.find(
      (item: any) => item.itemName.toLowerCase() === tx.itemName.toLowerCase()
    );

    if (invItem) {
      if (tx.type === 'penjualan') {
        // Rollback sale: replenish stock
        invItem.stock += tx.quantity;
      } else if (tx.type === 'pembelian_stok') {
        // Rollback purchase: deplete stock
        invItem.stock = Math.max(0, invItem.stock - tx.quantity);
      }
      invItem.lastUpdated = new Date().toISOString();
    }

    db.transactions.splice(txIndex, 1);
    await writeDB(db);
    res.json({ success: true, inventory: db.inventory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Directly update/reset/add inventory stock manually
app.post('/api/inventory', async (req, res) => {
  try {
    const { itemName, category, stock, unit, averageCost } = req.body;
    if (!itemName) {
      return res.status(400).json({ error: 'Nama barang wajib diisi' });
    }

    const db = await readDB();
    let item = db.inventory.find(
      (inv: any) => inv.itemName.toLowerCase() === itemName.toLowerCase()
    );

    if (item) {
      item.category = category || item.category;
      item.stock = Number(stock !== undefined ? stock : item.stock);
      item.unit = unit || item.unit;
      item.averageCost = Number(averageCost !== undefined ? averageCost : item.averageCost);
      item.lastUpdated = new Date().toISOString();
    } else {
      db.inventory.push({
        itemName,
        category: category || 'Lainnya',
        stock: Number(stock || 0),
        unit: unit || 'pcs',
        averageCost: Number(averageCost || 0),
        lastUpdated: new Date().toISOString(),
      });
    }

    await writeDB(db);
    res.json({ success: true, inventory: db.inventory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete inventory item
app.delete('/api/inventory/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const db = await readDB();
    db.inventory = db.inventory.filter(
      (item: any) => item.itemName.toLowerCase() !== decodeURIComponent(name).toLowerCase()
    );
    await writeDB(db);
    res.json({ success: true, inventory: db.inventory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Database helper
app.post('/api/reset', async (req, res) => {
  try {
    const initialData = {
      transactions: [],
      inventory: []
    };
    await writeDB(initialData);
    res.json({ success: true, ...initialData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Parsing endpoint: Uses Gemini API 3.5-flash to extract entities
app.post('/api/parse-voice', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Suara / kalimat input tidak ditemukan' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'API Key Gemini (GEMINI_API_KEY) belum dikonfigurasi di menu Settings > Secrets.',
    });
  }

  try {
    const prompt = `Analisis kalimat transaksi berikut dari seorang pedagang warung di Indonesia:
"${text}"

Tugas Anda adalah mengekstrak atribut transaksi secara akurat ke dalam format JSON. Pedagang mungkin menggunakan bahasa gaul, kata penunjuk jumlah informal (seperti kardus, pak, renteng, kg, bks), angka singkatan (misal '45 ribu' menjadi 45000, '35 ribu' menjadi 35000, 'total setengah juta' menjadi 500000), bahasa daerah (Sunda, Jawa) atau campuran.

ATURAN EKSTRAKSI:
1. transactionType: tentukan 'penjualan' jika barang laku terjual ke pembeli. Tentukan 'pembelian_stok' jika pedagang belanja barang (misal 'masuk stok', 'beli dari agen', 'kulakan', 'menyetok'). Jika benar-benar tidak jelas, gunakan 'unknown'.
2. nominal: nilai total transaksi dalam Rupiah. Mengkonversi otomatis dari slang, misal "45 ribu" -> 45000. Jika tidak disebutkan nominal total, gunakan estimasi realistis atau hitung berdasarkan modal.
3. modal:
   - Jika transactionType adalah 'penjualan': ini adalah modal pokok (COGS) barang tersebut. Jika disebutkan di teks (misal 'modalnya 35 ribu'), catat nilai total modal yaitu 35000. Jika tidak disebutkan, perkirakan secara realistis (misal 70% sampai 85% dari nominal harga jual).
   - Jika transactionType adalah 'pembelian_stok': modal selalu sama dengan nilai nominal pembelian (jumlah uang yang dibayarkan ke agen).
4. itemName: nama barang dagangan. Kapitalisasikan huruf pertama setiap kata (Title Case). Contoh: 'Minyak Goreng Bimoli', 'Indomie Goreng'.
5. quantity: angka integer jumlah barang. Contoh: '3 pak' -> 3, '2 kardus' -> 2. Default ke 1 jika tidak ada.
6. unit: satuan barang. Contoh: 'pak', 'kardus', 'kg', 'renteng', 'pcs', 'bungkus'. Default ke 'pcs' jika tidak ada.
7. category: kategori barang. Harus merupakan satu dari string ini: 'Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'. Cocokkan beras dengan 'Beras', minyak dengan 'Minyak', sabun/deterjen/perlengkapan mandi dengan 'Sembako', mie/rokok/snack dengan 'Camilan', teh/kopi/air botol dengan 'Minuman'.`;

    const response = await generateWithFallback({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactionType: {
              type: Type.STRING,
              description: "Tipe transaksi. Harus 'penjualan' atau 'pembelian_stok' atau 'unknown'."
            },
            category: {
              type: Type.STRING,
              description: "Kategori produk. Harus satu dari: 'Sembako', 'Minyak', 'Beras', 'Minuman', 'Camilan', 'Bumbu', 'Lainnya'."
            },
            itemName: {
              type: Type.STRING,
              description: "Nama barang yang rapi dan berhuruf besar tiap awal kata."
            },
            quantity: {
              type: Type.INTEGER,
              description: "Jumlah barang."
            },
            unit: {
              type: Type.STRING,
              description: "Satuan barang (contoh: 'kg', 'kardus', 'bungkus', 'pcs')."
            },
            nominal: {
              type: Type.INTEGER,
              description: "Total nominal uang transaksi dalam Rupiah (Rupiah asli tanpa singkatan, contoh: 45000)."
            },
            modal: {
              type: Type.INTEGER,
              description: "Total harga modal pokok dalam Rupiah. Mengikuti aturan cogs penjualan atau total pembelian."
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: "Tingkat kepercayaan parser antara 0.0 sampai 1.0."
            },
            explanation: {
              type: Type.STRING,
              description: "Ringkasan sederhana dalam Bahasa Indonesia yang menjelaskan detail ekstraksi."
            }
          },
          required: [
            'transactionType',
            'category',
            'itemName',
            'quantity',
            'unit',
            'nominal',
            'modal',
            'confidenceScore',
            'explanation'
          ]
        }
      }
    }, ['gemini-3.1-flash-lite']);

    const resultText = response.text || '{}';
    const parsedData = JSON.parse(resultText.trim());

    res.json(parsedData);
  } catch (error: any) {
    console.error('Error calling Gemini:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint untuk melakukan analisis harga jual & diskon barang masuk secara AI
app.post('/api/analyze-restock', async (req, res) => {
  const { itemName, averageCost, category } = req.body;
  if (!itemName || averageCost === undefined) {
    return res.status(400).json({ error: 'Nama barang dan harga modal wajib dikirim' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'API Key Gemini (GEMINI_API_KEY) belum dikonfigurasi di menu Settings > Secrets.',
    });
  }

  try {
    const prompt = `Lakukan analisis finansial ritel sederhana untuk pemilik warung di Indonesia.
Barang: "${itemName}"
Kategori: "${category || 'Lainnya'}"
Harga modal per item: Rp ${Number(averageCost).toLocaleString('id-ID')}

Tugas Anda:
1. Rekomendasikan harga jual eceran yang wajar dan realistis di pasar Indonesia agar mendapatkan margin keuntungan yang sehat (sekitar 10% - 30% tergantung kategori produk ritel). Bulatkan ke ratusan atau ribuan terdekat supaya mudah memberi kembalian tunai (misal Rp 1.500, Rp 5.000, Rp 12.500).
2. Tentukan nominal maksimum diskon dalam Rupiah yang aman agar pemilik toko tidak menjual rugi (bawah harga modal pokok).
3. Berikan catatan atau rekomendasi strategis singkat (maksimum 2-3 kalimat) dalam bahasa santai, ramah, dan mendidik ritel. Jelaskan mengapa harga tersebut cocok dan bagaimana tips menawarkannya.

Kembalikan data terstruktur dalam format JSON.`;

    const response = await generateWithFallback({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hargaJualSaran: {
              type: Type.INTEGER,
              description: "Saran harga jual eceran dalam Rupiah (bulat, contoh: 12500)."
            },
            diskonMaksimalSaran: {
              type: Type.INTEGER,
              description: "Nominal maksimum diskon aman dalam Rupiah agar modal tetap kembali (contoh: 1000)."
            },
            catatanAnalisis: {
              type: Type.STRING,
              description: "Tips ritel & penjelasan mengapa harga itu dipilih dalam Bahasa Indonesia santai bersahabat."
            }
          },
          required: ['hargaJualSaran', 'diskonMaksimalSaran', 'catatanAnalisis']
        }
      }
    }, ['gemini-3.1-flash-lite']);

    const resultText = response.text || '{}';
    const parsedData = JSON.parse(resultText.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error saat melakukan analisis stok AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint untuk membuat Caption + Gambar Promosi Medsos (Instagram/WA) secara AI
app.post('/api/social-media', async (req, res) => {
  const { itemName, type, averageCost, sellingPrice } = req.body;
  if (!itemName) {
    return res.status(400).json({ error: 'Nama barang wajib dikirim' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'API Key Gemini (GEMINI_API_KEY) belum dikonfigurasi di menu Settings > Secrets.',
    });
  }

  try {
    // 1. Generate caption dan image generator prompt
    const metaPrompt = `Buat caption sosial media promosi pemasaran untuk toko sembako/kelontong UMKM "SobatWarung AI" di Indonesia.
Nama barang: "${itemName}"
Tipe Posting: "${type || 'restock'}" (bisa 'restock' [info barang baru masuk], 'promo' [diskon/penawaran menarik], atau 'slow_sell' [cuci gudang biar cepat laku])
Harga Modal: ${averageCost ? `Rp ${Number(averageCost).toLocaleString('id-ID')}` : 'Tidak disebut'}
Harga Jual: ${sellingPrice ? `Rp ${Number(sellingPrice).toLocaleString('id-ID')}` : 'Tidak disebut'}

Tugas Anda:
1. Buat caption medsos (Instagram/WhatsApp Story) yang menarik, ceria, interaktif untuk pembeli tetangga/warung kelontong, menyertakan emoji lucu, detail ajakan bertindak (Call to Action) agar segera datang belanja, serta hashtag relevan (min 3 hashtag, misal #SobatWarung, #UMKMJuara, #SembakoMurah).
2. Tulis sebuah prompt deskriptif dalam Bahasa Inggris untuk menghasilkan gambar grafis media sosial berkualitas tinggi. Prompt tersebut harus mendeskripsikan gambar postingan persegi (1:1), dengan gaya 3D render imut atau flat design vector modern, berwarna cerah, menunjukkan produk bersangkutan, sangat cocok untuk toko UMKM Indonesia. Jangan masukkan teks yang berantakan atau wajah abstrak yang jelek.

Kembalikan data terstruktur dalam format JSON.`;

    const response = await generateWithFallback({
      model: 'gemini-3.5-flash',
      contents: metaPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: {
              type: Type.STRING,
              description: "Caption lengkap promosi bahasa indonesia berkilauan emoji dan hashtag."
            },
            imagePrompt: {
              type: Type.STRING,
              description: "Prompt bahasa inggris super spesifik dan visual untuk gemini-2.5-flash-image."
            }
          },
          required: ['caption', 'imagePrompt']
        }
      }
    }, ['gemini-3.1-flash-lite']);

    const parsedSocial = JSON.parse(response.text?.trim() || '{}');

    // 2. Generate gambar promo e-commerce menggunakan nano banana series (gemini-3.1-flash-image/gemini-2.5-flash-image) secara server-side
    const imageResponse = await generateWithFallback({
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          {
            text: `High-quality colorful social media advertising square graphic post, 1:1 aspect ratio, ${parsedSocial.imagePrompt || `vibrant creative design showcasing ${itemName} in a cozy indonesian neighborhood grocery shop grocery items, minimalist flat vector art`}`
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    }, ['gemini-2.5-flash-image']);

    let imageUrl = '';
    if (imageResponse.candidates?.[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    // Fallback if image generation fails using Picsum
    if (!imageUrl) {
      imageUrl = `https://picsum.photos/seed/${encodeURIComponent(itemName)}/805/805`;
    }

    res.json({
      caption: parsedSocial.caption,
      imagePrompt: parsedSocial.imagePrompt,
      imageUrl
    });

  } catch (error: any) {
    console.error('Error saat membuat materi sosial media:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET Weekend narrative report summary from Gemini
app.get('/api/weekly-report', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'API Key Gemini (GEMINI_API_KEY) belum dikonfigurasi di menu Settings > Secrets.',
    });
  }

  try {
    const db = await readDB();

    // Calculate current week statistics
    let totalSales = 0;
    let totalProfit = 0;
    let totalRestocksCost = 0;
    let saleItemCounts: { [key: string]: number } = {};

    db.transactions.forEach((tx: any) => {
      if (tx.type === 'penjualan') {
        totalSales += tx.nominal;
        totalProfit += (tx.nominal - tx.modal);
        saleItemCounts[tx.itemName] = (saleItemCounts[tx.itemName] || 0) + tx.quantity;
      } else if (tx.type === 'pembelian_stok') {
        totalRestocksCost += tx.nominal;
      }
    });

    // Find most sold item
    let mostSoldItem = 'Belum ada barang';
    let maxQty = 0;
    Object.entries(saleItemCounts).forEach(([name, qty]) => {
      if (qty > maxQty) {
        maxQty = qty;
        mostSoldItem = `${name} (${qty}x)`;
      }
    });

    // Find low stock items (stock < 5)
    const lowStockItems = db.inventory
      .filter((item: any) => item.stock < 5)
      .map((item: any) => `${item.itemName} (Stok tinggal ${item.stock} ${item.unit})`);

    // Prepare prompting content
    const statsSummary = {
      totalSales,
      totalProfit,
      totalRestocksCost,
      totalTransactions: db.transactions.length,
      mostSoldItem,
      lowStockItems,
    };

    const prompt = `Anda adalah seorang Konsultan Keuangan Kepercayaan Pemilik Warung Tradisional di Indonesia (dipanggil 'Asisten SuaraWarung').
Berikut adalah ringkasan data transaksi dan inventory warung Bos saat ini:
- Total Transaksi: ${statsSummary.totalTransactions}
- Total Penjualan (Omset): Rp ${statsSummary.totalSales.toLocaleString('id-ID')}
- Total Pendapatan Bersih (Laba): Rp ${statsSummary.totalProfit.toLocaleString('id-ID')}
- Pengeluaran Belanja Stok (Kulakan): Rp ${statsSummary.totalRestocksCost.toLocaleString('id-ID')}
- Barang Paling Laris Terjual: ${statsSummary.mostSoldItem}
- Daftar Barang Menipis / Habis (Hampir Habis): ${statsSummary.lowStockItems.length > 0 ? statsSummary.lowStockItems.join(', ') : 'Semua stok aman!'}

Tugas Anda adalah merangkum laporan tersebut menjadi sebuah pesan sapaan suara naratif yang sangat bersahabat, penuh semangat, menggunakan panggilan 'Bos' atau 'Juragan', menggunakan istilah-istilah warung populer seperti 'kulakan', 'laris manis', 'omset', 'modal', 'cuan', 'rejeki'.

Format yang wajib kamu kembalikan adalah JSON yang berisi:
1. text: Teks narasi lengkap laporan suara yang ramah dan inspiratif. (Maksimum 3-4 kalimat padat, jangan terlalu panjang agar enak didengar).
   Contoh: "Halo Bos! Minggu ini laporan warung mantap banget. Penjualan kita tembus Rp 253.500 dengan total keuntungan bersih Rp 45.000, cuan banget! Barang paling laris manis adalah Beras Rojo Lele. Oh iya Bos, minyak goreng sisa dikit nih, jangan lupa kulakan ya biar gak kehabisan pelanggan. Rejeki lancar jaya!"
2. achievement: 1 frasa singkat berdaya tarik yang menunjukkan pencapaian utama minggu ini. Contoh: "Laba Bersih Rp 45.000!" atau "Indomie Goreng Terlaris!"
3. tips: 1 tips bisnis praktis dan sederhana untuk mengembangkan warung sapaan ini. Contoh: "Cobain pajang kopi rencengan di depan gantungan biar pembeli makin kepincut lewat, Bos!"

Kembalikan format JSON murni tanpa markdown tambahan.`;

    const response = await generateWithFallback({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            achievement: { type: Type.STRING },
            tips: { type: Type.STRING },
          },
          required: ['text', 'achievement', 'tips'],
        },
      },
    }, ['gemini-3.1-flash-lite']);

    const resultText = response.text || '{}';
    const parsedReport = JSON.parse(resultText.trim());

    // Fill structural defaults
    res.json({
      ...parsedReport,
      mostSoldItem,
      outOfStockOrLow: lowStockItems,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Synthesize Voice report via Gemini TTS (gemini-3.1-flash-tts-preview)
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Teks narasi wajib diisi untuk mengubah ke suara' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'API Key Gemini belum diatur di Secrets.',
    });
  }

  try {
    // Generate spoken audio via gemini-3.1-flash-tts-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: `Say cheerfully in Indonesian: ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            // Zephyr is warm & cheerful
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.json({ 
        error: 'Sintesis suara Google dibatasi atau bermasalah. Menggunakan pengucap lokal browser...', 
        useBrowserFallback: true 
      });
    }
  } catch (error: any) {
    console.error('Error during TTS generation:', error);
    res.json({ 
      error: 'Kuota TTS AI penuh / error 429. Menggunakan pengucap lokal browser...', 
      useBrowserFallback: true 
    });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SuaraWarung Server running on port ${PORT}`);
  });
}

startServer();
