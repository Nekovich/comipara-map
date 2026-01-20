<script setup>
import { onMounted, ref, nextTick } from 'vue'; // Tambah nextTick
import { supabase } from './supabase';

const svgContent = ref('');
const errorMessage = ref('');
const loading = ref(false);

const selectedBooth = ref('');
const infoCircle = ref(null);
const showForm = ref(false);
const inputNama = ref('');
const inputFandom = ref('');

// --- FUNGSI BARU: Mewarnai Peta ---
async function warnaiPeta() {
  // 1. Ambil SEMUA data dari database (hanya ID dan Status)
  const { data, error } = await supabase
    .from('circles')
    .select('booth_id, status');

  if (error) {
    console.error("Gagal ambil warna:", error);
    return;
  }

  // 2. Loop setiap data, cari kotaknya di peta, dan warnai
  data.forEach(item => {
    // Cari elemen SVG berdasarkan ID (misal: elemen A-01)
    const elemenMeja = document.getElementById(item.booth_id);
    
    if (elemenMeja) {
      // Tentukan warna
      if (item.status === 'verified') {
        elemenMeja.style.fill = '#42b883'; // Hijau
      } else if (item.status === 'pending') {
        elemenMeja.style.fill = '#f7b731'; // Oranye
      }
    }
  });
}

// 1. Load Peta
onMounted(async () => {
  try {
    // Load SVG
    const response = await fetch('/test_peta.svg');
    if (!response.ok) throw new Error("Gagal load SVG");
    svgContent.value = await response.text();

    // TUNGGU sebentar agar SVG benar-benar muncul di layar
    await nextTick();

    // Panggil fungsi mewarnai
    warnaiPeta();

  } catch (error) {
    errorMessage.value = error.message;
  }
});

// 2. Klik Meja (Sama seperti sebelumnya)
async function onPetaClick(event) {
  const target = event.target;
  
  if (target.id && target.id !== "") {
    const idMeja = target.id;
    selectedBooth.value = idMeja;
    
    // Reset
    infoCircle.value = null;
    showForm.value = false;
    loading.value = true;
    inputNama.value = '';
    inputFandom.value = '';

    // Ambil detail meja ini
    const { data, error } = await supabase
      .from('circles')
      .select('*')
      .eq('booth_id', idMeja)
      .single();

    loading.value = false;

    if (error && error.code === 'PGRST116') {
      showForm.value = true; 
    } else if (data) {
      infoCircle.value = data;
    }
  }
}

// 3. Submit Data (Sedikit update agar warna langsung berubah)
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
      status: 'pending'
    });

  loading.value = false;

  if (error) {
    alert("Gagal menyimpan data!");
  } else {
    alert("Berhasil! Data menunggu verifikasi.");
    // Warnai manual jadi oranye agar user langsung lihat hasilnya
    const elemenMeja = document.getElementById(selectedBooth.value);
    if (elemenMeja) {
      elemenMeja.style.fill = '#f7b731'; 
      elemenMeja.style.opacity = '1';
    }
    // Refresh info panel
    const fakeEvent = { target: { id: selectedBooth.value } };
    onPetaClick(fakeEvent);
  }
}
</script>

<template>
  <div class="container">
    <h1>Peta Interaktif Comipara</h1>

    <div class="layout">
      <div 
        class="peta-box" 
        v-html="svgContent"
        @click="onPetaClick"
      ></div>

      <div class="info-panel">
        
        <div v-if="!selectedBooth" class="placeholder-text">
          <p>Klik salah satu kotak meja di peta untuk melihat detail atau mendaftarkan circle.</p>
        </div>

        <div v-else-if="loading">
          <p>Sedang memuat data...</p>
        </div>

        <div v-else-if="infoCircle" class="card">
          <h3>Meja: {{ infoCircle.booth_id }}</h3>
          <p><strong>Nama:</strong> {{ infoCircle.circle_name }}</p>
          <p><strong>Fandom:</strong> {{ infoCircle.fandoms }}</p>
          
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
            <input v-model="inputNama" type="text" placeholder="Contoh: Kucing Terbang">
          </div>
          
          <div class="form-group">
            <label>Fandom yang dijual:</label>
            <input v-model="inputFandom" type="text" placeholder="Contoh: Arknights, Blue Archive">
          </div>

          <button @click="submitData" class="btn-submit">Simpan Data</button>
          <button @click="showForm = false" v-if="infoCircle" class="btn-cancel">Batal</button>
        </div>

      </div>
    </div>
  </div>
</template>

<style>
.container { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
.layout { display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap; }
.peta-box { flex: 2; border: 1px solid #ccc; padding: 10px; min-width: 300px; }
.info-panel { flex: 1; background: #f9f9f9; padding: 20px; border-radius: 8px; min-width: 250px; }

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
</style>