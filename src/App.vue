<script setup>
import panzoom from 'panzoom'; // untuk fitur zoom dan pan
import { onMounted, ref, nextTick, computed, watch } from 'vue'; 
import { supabase } from './supabase';
import { operatorArknights } from './data/ListOperator';

// --- DAFTAR VARIABLE ---
const svgContent = ref(''); //  untuk menyimpan konten SVG
const errorMessage = ref(''); // untuk menyimpan pesan error
const loading = ref(false); // untuk menandai status loading
const selectedBooth = ref(''); // untuk menyimpan ID meja yang dipilih
const infoCircle = ref(null); // untuk menyimpan data circle yang diambil
const showForm = ref(false); // untuk mengontrol tampilan form input
const inputNama = ref(''); // untuk input nama circle
const inputFandom = ref([]); // untuk input fandom (array)
const allCirclesCache = ref([]); // Untuk menyimpan data lengkap agar pencarian cepat
const inputSearch = ref(''); // Untuk kotak pencarian global
const filterInput = ref(''); // Untuk kotak input filter karakter
const filterTags = ref([]); // Untuk menyimpan tag karakter yang dipilih sebagai filter
const filterSaran = computed(() => {
  // 1. Ambil semua karakter yang BELUM dipilih
  const belumDipilih = masterKarakter.filter(nama => !filterTags.value.includes(nama));

  // 2. Jika user mengetik sesuatu -> Filter berdasarkan ketikan
  if (filterInput.value !== '') {
    return belumDipilih.filter(nama => 
      nama.toLowerCase().includes(filterInput.value.toLowerCase())
    );
  }

  // 3. BARU: Jika kotak sedang diklik (Fokus) walau kosong -> Tampilkan SEMUA saran
  if (isFilterFocused.value) {
    return belumDipilih;
  }

  // 4. Jika tidak diklik dan kosong -> Sembunyikan
  return [];
}); // untuk Saran karakter untuk filter
const lastSelectedElement = ref(null); // untuk menyimpan elemen SVG terakhir yang dipilih
const isFilterFocused = ref(false); // Penanda apakah kotak sedang diklik

// DAFTAR FANDOM === isi data fandom apa saja dsini
const daftarFandom = [
  'Arknights',
  'Arknights Endfield',
];

// DATA MASTER KARAKTER === isi data karakter apa saja disini
const masterKarakter = operatorArknights;
const inputSearchKarakter = ref(''); // Apa yang diketik user (misal: "wisa")
const selectedKarakter = ref([]);    // Apa yang sudah dipilih (misal: ['Wisadel'])

const saranKarakter = computed(() => {
  // Jika kotak pencarian kosong, jangan tampilkan apa-apa
  if (inputSearchKarakter.value === '') {
    return [];
  }
  
  // Filter nama yang COCOK dan BELUM DIPILIH
  return masterKarakter.filter(nama => 
    nama.toLowerCase().includes(inputSearchKarakter.value.toLowerCase()) &&
    !selectedKarakter.value.includes(nama)
  );
});

// AKHIR DAFTAR VARIABEL --- IGNORE ---

function onFilterBlur() {
  setTimeout(() => {
    isFilterFocused.value = false;
  }, 200);
}

// FUNGI WARNAI PETA (LOGIKA DEFAULT)
/// FUNGSI WARNAI PETA (LOGIKA DEFAULT)
async function warnaiPeta() {
  const { data, error } = await supabase
    .from('circles')
    .select('*');

  if (error) return; 

  allCirclesCache.value = data; 

  // --- 1. RESET SEMUA MEJA JADI BIRU MUDA (DEFAULT) ---
  // Kita paksa warna biru lewat Javascript agar tidak ada yang lolos jadi abu-abu/hitam
  const semuaMeja = document.querySelectorAll('svg rect, svg path, svg polygon');
  
  semuaMeja.forEach(meja => {
    if (meja.id) {
      meja.style.fill = '#3498db';       // Biru Muda (Default)
      meja.style.fillOpacity = '0.05';   // Transparan
      meja.style.stroke = 'none'; 
      
      // Hapus class sisa pencarian jika ada
      meja.classList.remove('search-match');
      meja.classList.remove('meja-selected');
    }
  });

  // --- 2. TIMPA WARNA BERDASARKAN DATA ---
  data.forEach(item => {
    const elemenMeja = document.getElementById(item.booth_id);
    
    // PENTING: Cek apakah meja ini benar-benar ada isinya?
    // Jika nama circle KOSONG, kita anggap meja ini "Belum Ada Data" -> Biarkan tetap Biru
    if (!item.circle_name || item.circle_name.trim() === '') {
       return; // Skip, jangan diapa-apain (tetap biru dari langkah 1)
    }

    if (elemenMeja) {
      // Ambil data fandom
      const listFandom = item.fandoms || [];
      const isMainFandom = listFandom.includes('Arknights') || listFandom.includes('Arknights Endfield');

      if (!isMainFandom) {
        // KASUS 2: ADA DATA TAPI BUKAN ARKNIGHTS -> ABU-ABU
        elemenMeja.style.fill = '#9a9a9a'; 
        elemenMeja.style.fillOpacity = '0.8'; 
      
      } else if (item.status === 'verified') {
        // KASUS 3: ARKNIGHTS + VERIFIED -> HIJAU
        elemenMeja.style.fill = '#42b883'; 
        elemenMeja.style.fillOpacity = '0.8'; 
      
      } else {
        // KASUS 4: ARKNIGHTS + PENDING -> OREN
        elemenMeja.style.fill = '#f7b731'; 
        elemenMeja.style.fillOpacity = '0.8'; 
      }
    }
  });
}

// 1. Load Peta SVG dan Inisialisasi Zoom
onMounted(async () => {
  console.log("--- MEMULAI PROSES LOAD ---"); // Cek 1

  try {
    const namaFile = '/peta_comipara_utama2.svg'; // Ganti dengan path SVG disini
    console.log("Mencoba mengambil file:", namaFile); // Cek 2
    const response = await fetch(namaFile);
    console.log("Status Server:", response.status); // Cek 3 
    if (!response.ok) {
      throw new Error(`Gagal! Status: ${response.status}`);
    }

    const text = await response.text();
    console.log("Isi File (Huruf awal):", text.substring(0, 100)); // Cek 4 (Harusnya <svg...)

    svgContent.value = text;

    await nextTick(); // Tunggu sampai DOM ter-update

    // --- MULAI KODE ZOOM ---
    const elementPeta = document.getElementById('peta-scene');
    
    if (elementPeta) {
      panzoom(elementPeta, {
        maxZoom: 12,        // Bisa zoom in sampai 5x lipat
        minZoom: 0.5,      // Bisa zoom out sampai setengah ukuran
        bounds: true,      // Agar peta tidak bisa digeser sampai hilang dari layar
        boundsPadding: 0.5 // Batas kelonggaran pinggir
      });
      console.log("Fitur Zoom Aktif!");
    }
    // --- SELESAI KODE ZOOM ---

    // Beri jeda sedikit (100ms) untuk memastikan SVG benar-benar siap
    setTimeout(() => {
        warnaiPeta();
    }, 100);


  } catch (error) {
    console.error("ERROR FATAL:", error); // Cek Error
    errorMessage.value = "Error: " + error.message;
  }
});

// 2. Klik Meja 
async function onPetaClick(event) {
  const target = event.target;

  // --- LOGIKA 1: DESELECT (KLIK SEMBARANG) ---
  // Jika yang diklik TIDAK punya ID, atau ID-nya kosong (artinya klik lantai/background)
  if (!target || !target.id || target.id === "") {
    
    // 1. Hapus warna biru dari meja terakhir di klik (jika ada)
    if (lastSelectedElement.value) {
      lastSelectedElement.value.classList.remove('meja-selected');
      lastSelectedElement.value = null; // Lupakan meja tersebut
    }

    // 2. Kosongkan semua data di panel kanan
    selectedBooth.value = '';
    infoCircle.value = null;
    showForm.value = false;
    
    // 3. Reset inputan form
    inputNama.value = '';
    inputFandom.value = [];
    selectedKarakter.value = [];
    inputSearchKarakter.value = '';

    // Berhenti di sini, jangan lanjut ke bawah
    return; 
  }

  // --- LOGIKA 2: SELECT (KLIK MEJA) ---
  // Jika yang diklik adalah meja (ada ID)

  // A. Visual Highlight (Warna Biru)
  try {
    if (lastSelectedElement.value) {
      lastSelectedElement.value.classList.remove('meja-selected');
    }
    target.classList.add('meja-selected');
    lastSelectedElement.value = target;
  } catch (errVisual) {
    console.warn("Masalah visual:", errVisual);
  }

  // B. Ambil Data
  const idMeja = target.id;
  selectedBooth.value = idMeja;
  
  // Reset state loading
  infoCircle.value = null;
  showForm.value = false;
  loading.value = true; // Nyalakan loading

  try {
    const { data, error } = await supabase
      .from('circles')
      .select('*')
      .eq('booth_id', idMeja)
      .single();

    if (error && error.code === 'PGRST116') {
      showForm.value = true; // Data kosong -> Form Input
    } else if (data) {
      infoCircle.value = data; // Data ada -> Info Panel
      if (data.characters) selectedKarakter.value = data.characters;
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    loading.value = false; // Matikan loading
  }
}

// 3. Submit Data Form
async function submitData() {
  if (!inputNama.value || !inputFandom.value) {
    alert("Mohon isi nama circle dan fandom!");
    return;
  }

  loading.value = true;

  const { error } = await supabase
    .from('circles')
    .upsert({ 
      booth_id: selectedBooth.value,
      circle_name: inputNama.value,
      fandoms: inputFandom.value,
      characters: selectedKarakter.value,
      status: 'pending'
    });

  loading.value = false;

  if (error) {
    alert("Gagal menyimpan data!");
  } else {
    alert("Berhasil! Tunggu admin memverifikasi data anda.");
    // setealah user mengisi, Warnai manual jadi oranye agar user langsung lihat hasilnya
    const elemenMeja = document.getElementById(selectedBooth.value);

    if (elemenMeja) {
      // Cek apa yang barusan diinput user
      const listFandom = inputFandom.value || [];
      const isMainFandom = listFandom.includes('Arknights') || listFandom.includes('Arknights Endfield');

      if (!isMainFandom) {
        // Jika user tidak mencentang Arknights/Endfield -> menjadi abu-abu
        elemenMeja.style.fill = '#95a5a6';
        elemenMeja.style.fillOpacity = '0.6';
      } else {
        // Jika ada Arknights atau Enfield -> menjadi ORANYE (Pending)
        elemenMeja.style.fill = '#f7b731'; 
        elemenMeja.style.fillOpacity = '0.6';
      }
    }
    // Refresh info panel
    const fakeEvent = { target: { id: selectedBooth.value } };
    onPetaClick(fakeEvent);
  }
}

// 4. FUNGSI TAMBAH & HAPUS karakter di form (filter)
function tambahKarakter(nama) {
  selectedKarakter.value.push(nama); // Masukkan ke keranjang
  inputSearchKarakter.value = '';    // Reset kotak ketik
}

function hapusKarakter(nama) {
  selectedKarakter.value = selectedKarakter.value.filter(item => item !== nama);
}
function addFilterTag(nama) {
  filterTags.value.push(nama);
  filterInput.value = ''; // Reset ketikan
  jalankanFilter();       // Langsung update peta
}
function removeFilterTag(nama) {
  filterTags.value = filterTags.value.filter(tag => tag !== nama);
  jalankanFilter();       // Langsung update peta
}
// LOGIKA FILTER SPOTLIGHT (VERSI BERSIH)
function jalankanFilter() {
  const tags = filterTags.value;

  if (tags.length === 0) {
    warnaiPeta();
    return;
  }

  allCirclesCache.value.forEach(item => {
    const elemenMeja = document.getElementById(item.booth_id);
    if (!elemenMeja) return;

    const isMatch = item.characters?.some(char => tags.includes(char));

    if (isMatch) {
      // --- MATCH ---
      if (item.status === 'verified') {
        elemenMeja.style.fill = '#42b883'; 
      } else {
        elemenMeja.style.fill = '#f7b731'; 
      }
      elemenMeja.style.fillOpacity = '0.8'; 
      
    } else {
      // --- TIDAK MATCH ---
      elemenMeja.style.fill = '#dcdde1'; 
      elemenMeja.style.fillOpacity = '0.8'; 
    }
  });
}

// --- LOGIKA PENCARIAN (SEARCH ENGINE) ---
watch(inputSearch, (keywordBaru) => {
  const keyword = keywordBaru.toLowerCase();

  // 1. Jika kotak pencarian KOSONG -> Reset Peta ke warna asli
  if (keyword === '') {
    warnaiPeta(); // Panggil ulang fungsi pewarna normal
    return;
  }

  // 2. Jika ada ketikan -> Lakukan Pencarian
  const hasilCari = allCirclesCache.value.filter(item => {
    // Cek Nama Circle
    const cekNama = item.circle_name && item.circle_name.toLowerCase().includes(keyword);
    
    // Cek Fandom (Array)
    const cekFandom = item.fandoms && item.fandoms.some(f => f.toLowerCase().includes(keyword));
    
    // Cek Karakter (Array)
    const cekChar = item.characters && item.characters.some(c => c.toLowerCase().includes(keyword));

    return cekNama || cekFandom || cekChar;
  });

  // Ambil daftar ID yang ketemu
  const idKetemu = hasilCari.map(item => item.booth_id);

  // 3. Update Tampilan Peta
  //loop semua elemen SVG yang punya ID (meja)
  const semuaMeja = document.querySelectorAll('svg rect, svg path, svg polygon');
  
  semuaMeja.forEach(meja => {
    if (meja.id) {
      if (idKetemu.includes(meja.id)) {
        // JIKA KETEMU: Tambah kelas Highlight
        meja.classList.add('search-match');
        meja.style.fillOpacity = '1'; // Paksa solid
      } else {
        // JIKA TIDAK KETEMU: Redupkan (Ghost Mode)
        meja.classList.remove('search-match');
        meja.style.fill = '#000'; // Jadi hitam pudar
        meja.style.fillOpacity = '0.1'; // Sangat transparan
      }
    }
  });
});


</script>

<template>
  <div class="container">
    <h1>Peta Arknights di Comipara</h1>

    <div class="layout">
      
      <div class="col-left">

        <div id="peta-container" class="map-window">
          <div id="peta-scene">
            <div 
              class="peta-box" 
              v-html="svgContent"
              @click="onPetaClick"
            ></div>
          </div>
        </div>

        <div class="zoom-controls">
          <small>Gunakan Scroll Mouse untuk Zoom, Klik Tahan untuk Geser</small>
        </div>

        

      </div>
      <div class="info-panel">

        <div v-if="!selectedBooth" class="placeholder-text">
          <p>Klik salah satu kotak meja di peta untuk melihat detail info</p>
        </div>

        <div v-else-if="loading">
          <p>Sedang memuat data...</p>
        </div>

        <div v-else-if="infoCircle" class="card">
          <h3>Meja: {{ infoCircle.booth_id }}</h3>
          <p><strong>Nama:</strong> {{ infoCircle.circle_name }}</p>
          <p>
            <strong>Fandom:</strong>
            <span v-if="Array.isArray(infoCircle.fandoms)">
              {{ infoCircle.fandoms.join(', ') }}
            </span>
            <span v-else>
              {{ infoCircle.fandoms || '-' }}
            </span>
          </p>
          <p>
            <strong>Karakter:</strong> 
              {{ infoCircle.characters ? infoCircle.characters.join(', ') : '-' }}
          </p>
          
          <div :class="['status-badge', infoCircle.status]">
            {{ infoCircle.status === 'verified' ? 'Terverifikasi' : 'Menunggu Verifikasi' }}
          </div>

          <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
            <small style="color: grey;">Data salah? </small>
            <button @click="showForm = true" class="btn-small">Edit Data</button>
          </div>
        </div>

        <div v-if="showForm" class="form-card">
          <h3>Isi Data Circle ({{ selectedBooth }})</h3>
          <p class="hint">Data baru akan berstatus "Pending" sampai diverifikasi admin.</p>
          
          <div class="form-group">
            <label>Nama Circle:</label>
            <input v-model="inputNama" type="text" placeholder="Contoh: SSR Cloth">
          </div>
          
          <div class="form-group">
            <label>Fandom yang dijual:</label>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 5px;">
              <label v-for="item in daftarFandom" :key="item" style="font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" :value="item" v-model="inputFandom">
                {{ item }}
              </label>
            </div>
            <small style="color: grey;">Terpilih: {{ inputFandom.join(', ') }}</small>
          </div>

          <div class="form-group" style="position: relative;">
            <label>Karakter (Ketik untuk cari):</label>
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 5px;">
              <span v-for="char in selectedKarakter" :key="char" style="background: #e0f2f1; color: #00695c; padding: 2px 8px; border-radius: 12px; font-size: 0.9em; display: flex; align-items: center; gap: 5px;">
                {{ char }}
                <button @click="hapusKarakter(char)" style="background:none; border:none; cursor:pointer; color: #d32f2f; font-weight:bold;">&times;</button>
              </span>
            </div>

            <input type="text" v-model="inputSearchKarakter" placeholder="Contoh: Amiya, Doktah, Wisadel..." style="width: 100%; padding: 8px; box-sizing: border-box;">

            <ul v-if="saranKarakter.length > 0" style="position: absolute; z-index: 10; background: white; width: 100%; border: 1px solid #ddd; list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <li v-for="saran in saranKarakter" :key="saran" @click="tambahKarakter(saran)" style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                {{ saran }}
              </li>
            </ul>
          </div>

          <button @click="submitData" class="btn-submit">Simpan Data</button>
          <button @click="showForm = false" v-if="infoCircle" class="btn-cancel">Batal</button>
        </div>

        

      </div>
    </div>
    <div class="search-box" style="
      background: white; 
      padding: 15px; 
      border-radius: 8px; 
      border: 1px solid #ddd; 
      margin-top: 20px;
      margin-bottom: 300px; 
      position: relative;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
      ">
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">Filter Karakter:</label>

          <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 5px;">
            <span 
                v-for="tag in filterTags" 
                :key="tag"
                style="
                  background: #e056fd; 
                  color: white; 
                  padding: 4px 10px 4px 4px; /* Padding kiri lebih kecil biar gambar nempel ujung */
                  border-radius: 20px;       /* Lebih bulat biar seperti kapsul */
                  font-size: 0.9em; 
                  display: flex; 
                  align-items: center; 
                  gap: 6px; 
                  font-weight: bold;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                "
            >
                <img 
                  :src="`/characters/${tag}.png`" 
                  alt=""
                  style="
                    width: 24px; 
                    height: 24px; 
                    border-radius: 50%; /* Bulat sempurna */
                    object-fit: cover; 
                    background: white; 
                    border: 2px solid white; /* Bingkai putih tipis biar rapi */
                  "
                  onerror="this.style.display='none'"
                />
              {{ tag }}
              <button 
                  @click="removeFilterTag(tag)" 
                  style="
                    background: none; 
                    border: none; 
                    color: white; 
                    cursor: pointer; 
                    font-weight: bold; 
                    font-size: 1.1em;
                    margin-left: 2px;
                    opacity: 0.8;
                  "
                  onmouseover="this.style.opacity='1'"
                  onmouseout="this.style.opacity='0.8'"
                >
                  &times;
                </button>
            </span>
          </div>

          <input 
            type="text" 
            v-model="filterInput" 
            placeholder="Ketik nama karakter (misal: Amiya)..." 
            style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
            @focus="isFilterFocused = true" 
            @blur="onFilterBlur"
          >

            <ul v-if="filterSaran.length > 0" style="
              position: absolute; top: 100%; left: 0; right: 0; z-index: 100; 
              background: white; border: 1px solid #ddd; border-radius: 0 0 8px 8px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.1);
              max-height: 500px; /* Tinggi maksimal daftar saran */
              overflow-y: auto;
              display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); 
              gap: 8px; padding: 10px; list-style: none; margin: 0; 
            ">
              <li 
                v-for="saran in filterSaran" 
                :key="saran" 
                @click="addFilterTag(saran)"
                style="
                  /* --- UBAH TINGGI KOTAK DI SINI --- */
                  height: 130px; /* Saya perbesar tingginya agar muat gambar portrait */
                  
                  display: flex; 
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                  background: #f8f9fa; 
                  border: 1px solid #eee;
                  border-radius: 8px;
                  cursor: pointer;
                  font-weight: bold;
                  font-size: 0.8em;
                  color: #444;
                  transition: all 0.2s;
                  overflow: hidden;
                  padding: 5px; /* Tambah padding dalam sedikit */
                "
                onmouseover="this.style.background='#e056fd'; this.style.color='white'; this.style.borderColor='#e056fd'; this.style.transform='scale(1.05)';"
                onmouseout="this.style.background='#f8f9fa'; this.style.color='#444'; this.style.borderColor='#eee'; this.style.transform='scale(1)';"
              >
                
                <img 
                  :src="`/characters/${saran}.png`" 
                  alt="" 
                  style="
                    /* --- GAYA GAMBAR BARU (TIDAK BUNDAR) --- */
                    width: 100%;         /* Lebar memenuhi kotak */
                    height: 90px;        /* Tinggi area gambar */
                    object-fit: contain; /* PENTING: Agar gambar utuh masuk ke area tanpa terpotong */
                    margin-bottom: 5px;
                    /* border-radius: 50%;  <-- INI YANG DULUA DIHAPUS */
                  "
                  onerror="this.style.display='none'" 
                />

                <span style="width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  {{ saran }}
                </span>

              </li>
            </ul>
    </div>
  </div>
</template>






<style>
.container {
   font-family: sans-serif; 
   max-width: 100%; 
   margin: 0 auto; 
   padding: 20px;
   padding-bottom: 300px;
  }

/* Layout Utama Flexbox */
.layout { 
  display: flex; 
  gap: 20px; 
  margin-top: 20px; 
  flex-wrap: wrap; /* Agar responsif di HP turun ke bawah */
}

/* Kolom Kiri (Peta) - Mengambil 2 bagian layar */
.col-left { 
  flex: 3; 
  min-width: 300px; 
}

/* Kolom Kanan (Info) - Mengambil 1 bagian layar */
.info-panel { 
  flex: 1; 
  background: #f9f9f9; 
  padding: 20px; 
  border-radius: 8px; 
  min-width: 250px; 
  height: fit-content; /* Agar panel tidak memanjang kosong ke bawah */
}

/* --- KODE ZOOM (Tetap sama seperti sebelumnya) --- */
.map-window {
  width: 100%;
  height: 600px;
  overflow: hidden;
  border: 2px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
  position: relative;
  cursor: grab;
}
.map-window:active { cursor: grabbing; }

#peta-scene {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.peta-box { 
  width: 100%;
  height: 100%;
}

/* Styling Kartu Info */
.card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.status-badge { display: inline-block; padding: 5px 12px; border-radius: 15px; font-size: 0.8em; color: white; margin-top: 10px; font-weight: bold;}
.status-badge.verified { background-color: #42b883; } /* Hijau */
.status-badge.pending { background-color: #f7b731; }  /* Oranye */

/* Styling Form */
.form-card { background: white; padding: 15px; border-radius: 8px; border: 2px solid #3498db; margin-top: 10px; }
.form-group { margin-bottom: 10px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.9em; }
.form-group input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
.hint { font-size: 0.8em; color: #666; margin-bottom: 15px; }

/* Tombol */
.btn-submit { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; width: 100%; font-weight: bold; }
.btn-submit:hover { background: #2980b9; }
.btn-small { background: none; border: 1px solid #ccc; padding: 2px 8px; cursor: pointer; font-size: 0.8em; border-radius: 4px; }
.btn-cancel { background: none; border: none; color: red; margin-top: 10px; cursor: pointer; width: 100%; }

/* SVG Responsif */
.peta-box svg { width: 100%; height: auto; }
.peta-box rect:hover, .peta-box path:hover { opacity: 1; cursor: pointer; fill: #3498db !important; transition: 0.2s; }

/* Target semua elemen kotak (rect), garis (path), atau polygon di dalam SVG */
svg rect, svg path, svg polygon {
  fill: #3498db;       /* Warna dasar */
  fill-opacity: 0.10;  /* Transparansi */
  stroke: none !important;     /* Hilangkan garis pinggir */
  cursor: pointer;  /* Ubah kursor jadi tangan */
  transition: all 0.2s ease; /* Animasi halus saat berubah warna */
}

/* Efek saat mouse diarahkan ke meja kosong */
svg rect:hover, svg path:hover, svg polygon:hover {
  fill: #3498db !important; /* Biru Transparan */
  fill-opacity: 0.8 !important; /* Jadi agak hitam sedikit saat di-hover */
}

/* Kanvas (Yang bergerak) */
#peta-scene {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Pastikan SVG menyesuaikan diri */
.peta-box svg {
  width: 100%;
  height: 100%;
  pointer-events: auto; /* Agar tetap bisa diklik */
}

/* 3. CLASS BARU: Meja Terpilih (Active State) */
/* Ini akan membuat meja tetap berwarna walaupun mouse pergi */
.meja-selected {
  fill: #3498db !important;  /* Hijau Terang */
  fill-opacity: 0.8 !important; /* Solid tapi agak tembus dikit */
  stroke: #fff !important;   /* Beri garis putih biar jelas terpilih */
  stroke-width: 2px !important;
}

/* EFEK PENCARIAN */

/* 1. Meja yang COCOK (Highlihgt) */
.search-match {
  fill: #e056fd !important;   /* Warna Magenta Terang */
  fill-opacity: 0.8 !important; /* Solid */
  stroke: white !important;
  stroke-width: 3px !important;
  z-index: 100; /* Agar muncul di atas */
  transition: all 0.2s;
}

/* 2. Animasi Berdenyut (Opsional, biar keren) */
@keyframes denyut {
  0% { fill-opacity: 1; }
  50% { fill-opacity: 0.6; }
  100% { fill-opacity: 1; }
}
.search-match {
  animation: denyut 1.5s infinite;
}


</style>