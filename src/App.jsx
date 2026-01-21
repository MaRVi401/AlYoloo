import { useState, useEffect, useRef } from 'react'
import * as tf from '@tensorflow/tfjs'
import Webcam from 'react-webcam'
import './App.css'

function App() {
  const [model, setModel] = useState(null);
  const [isCvReady, setIsCvReady] = useState(false);
  const [status, setStatus] = useState('Menyiapkan sistem...');
  const webcamRef = useRef(null);

  useEffect(() => {
    // 1. Inisialisasi OpenCV.js
    if (window.cv) {
      window.cv.onRuntimeInitialized = () => {
        setIsCvReady(true);
        console.log('OpenCV.js Ready');
      };
    }

    // 2. Memuat Model YOLO26 dari folder public/model
    const loadModel = async () => {
      try {
        setStatus('Memuat Model AI...');
        // Path ini harus sesuai dengan tempat Anda menyimpan model.json
        const loadedModel = await tf.loadGraphModel('/model/model.json');
        setModel(loadedModel);
        setStatus('Sistem Siap Digunakan');
        console.log('YOLO26 Model Loaded');
      } catch (error) {
        console.error('Gagal memuat model:', error);
        setStatus('Gagal memuat model AI');
      }
    };

    loadModel();
  }, []);

  // Fungsi untuk deteksi (Inference)
  const detectDocument = async () => {
    if (model && webcamRef.current && isCvReady) {
      const video = webcamRef.current.video;
      if (video.readyState === 4) {
        // Proses deteksi akan kita tulis di sini nanti
        console.log("Menjalankan deteksi...");
      }
    }
  };

  return (
    <div className="container">
      <h1>AI Document Scanner</h1>
      <p className="status-badge">{status}</p>

      <div className="scanner-wrapper">
        <Webcam
          ref={webcamRef}
          muted={true}
          className="webcam-view"
        />
        {/* Canvas untuk menggambar titik sudut hasil deteksi AI */}
        <canvas className="overlay-canvas" />
      </div>

      <div className="controls">
        <button 
          className="btn-capture"
          disabled={!model || !isCvReady}
          onClick={detectDocument}
        >
          Ambil Gambar
        </button>
      </div>

      <div className="history-section">
        <h3>Hasil Pemindaian Terbaru</h3>
        {/* Tempat untuk Local Data Persistence (IndexedDB) nanti */}
        <p>Belum ada dokumen tersimpan secara lokal.</p>
      </div>
    </div>
  )
}

export default App