import { useState, useEffect, useRef } from 'react'
import * as tf from '@tensorflow/tfjs'
import Webcam from 'react-webcam'
import './App.css'

function App() {
  const [model, setModel] = useState(null);
  const [isCvReady, setIsCvReady] = useState(false);
  const [status, setStatus] = useState('Menyiapkan sistem...');
  const [facingMode, setFacingMode] = useState('environment'); // environment = kamera belakang
  const webcamRef = useRef(null);

  useEffect(() => {
    // 1. Inisialisasi OpenCV.js
    const initCV = () => {
      if (window.cv && window.cv.onRuntimeInitialized) {
        window.cv.onRuntimeInitialized = () => {
          setIsCvReady(true);
          console.log('OpenCV.js Ready');
        };
      } else if (window.cv) {
        setIsCvReady(true);
      }
    };

    // 2. Memuat Model YOLO26
    const loadModel = async () => {
      try {
        setStatus('Memuat Model AI...');
        // Pastikan model.json ada di folder public/model/
        const loadedModel = await tf.loadGraphModel('/model/model.json');
        setModel(loadedModel);
        setStatus('Sistem Siap Digunakan');
        console.log('YOLO26 Model Loaded');
      } catch (error) {
        console.error('Gagal memuat model:', error);
        setStatus('Error: Model AI tidak ditemukan');
      }
    };

    initCV();
    loadModel();
  }, []);

  // Fungsi Toggle Kamera
  const switchCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'user' ? 'environment' : 'user'));
  };

  // Fungsi Deteksi (Akan diisi logika pemrosesan gambar)
  const detectDocument = async () => {
    if (model && webcamRef.current && isCvReady) {
      const video = webcamRef.current.video;
      if (video.readyState === 4) {
        setStatus('Sedang Memindai...');
        // Logika deteksi akan kita tambahkan di tahap berikutnya
        console.log("Menjalankan deteksi pada kamera " + facingMode);
      }
    }
  };

  return (
    <div className="container">
      <header>
        <h1>AI DocScanner</h1>
        <div className={`status-badge ${isCvReady && model ? 'ready' : 'loading'}`}>
          {status}
        </div>
      </header>

      <main className="scanner-container">
        <div className="webcam-wrapper">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: facingMode
            }}
            className="webcam-view"
          />
          {/* Canvas untuk overlay kotak deteksi */}
          <canvas className="overlay-canvas" />
        </div>

        <div className="button-group">
          <button 
            className="secondary-btn" 
            onClick={switchCamera}
          >
            🔄 Ganti ke Kamera {facingMode === 'user' ? 'Belakang' : 'Depan'}
          </button>
          
          <button 
            className="primary-btn"
            disabled={!model || !isCvReady}
            onClick={detectDocument}
          >
            📸 Ambil Gambar
          </button>
        </div>
      </main>

      <section className="history">
        <p>Data tersimpan di perangkat (Local Data Persistence)</p>
      </section>
    </div>
  )
}

export default App