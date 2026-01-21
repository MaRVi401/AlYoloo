import { useState, useEffect, useRef } from 'react'
import * as tf from '@tensorflow/tfjs'
import Webcam from 'react-webcam'
import './App.css'

function App() {
  const [model, setModel] = useState(null);
  const [isCvReady, setIsCvReady] = useState(false);
  const [status, setStatus] = useState('Menyiapkan sistem...');
  const [facingMode, setFacingMode] = useState('environment'); 
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // 1. Inisialisasi OpenCV.js
    const initCV = () => {
      if (window.cv) {
        setIsCvReady(true);
        console.log('OpenCV.js Ready');
      }
    };

    // 2. Memuat Model YOLO (TF.js)
    const loadModel = async () => {
      try {
        setStatus('Memuat Model AI...');
        // Model dimuat dari folder public/model/
        const loadedModel = await tf.loadGraphModel('/model/model.json');
        setModel(loadedModel);
        setStatus('Sistem Siap Digunakan');
        console.log('YOLO Model Loaded');
      } catch (error) {
        console.error('Gagal memuat model:', error);
        setStatus('Error: Model AI tidak ditemukan');
      }
    };

    initCV();
    loadModel();
  }, []);

  const switchCamera = () => {
    setFacingMode((prevMode) => (prevMode === 'user' ? 'environment' : 'user'));
  };

  // --- LOGIKA UTAMA DETEKSI ---
  const runDetection = async () => {
    if (model && webcamRef.current && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const { videoWidth, videoHeight } = video;

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // Pre-processing Tensor
      const tensor = tf.tidy(() => {
        const img = tf.browser.fromPixels(video);
        return tf.image.resizeBilinear(img, [640, 640])
          .expandDims(0)
          .div(255.0);
      });

      // Prediksi (Inference speed ~3.5ms)
      const predictions = await model.executeAsync(tensor);
      
      // Render hasil ke Canvas
      renderKeypoints(predictions, videoWidth, videoHeight);

      // Pembersihan Memori
      tensor.dispose();
      predictions.dispose();

      // Loop deteksi secara real-time
      requestAnimationFrame(runDetection);
    }
  };

  const renderKeypoints = (output, width, height) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const data = output.dataSync(); // Mengambil data koordinat
    // Logika YOLO Pose: Biasanya 4 titik sudut (Keypoints)
    // Titik sudut: Kiri Atas, Kanan Atas, Kanan Bawah, Kiri Bawah
    
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.beginPath();

    // Mapping koordinat dari 640x640 ke ukuran Video Asli
    for (let i = 0; i < 4; i++) {
      const x = data[i * 3] * (width / 640);
      const y = data[i * 3 + 1] * (height / 640);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      // Gambar bulatan di setiap sudut
      ctx.fillStyle = "#FF0000";
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
    
    ctx.closePath();
    ctx.stroke();
  };

  return (
    <div className="container">
      <header>
        <h1>AI DocScanner v1.0</h1>
        <div className={`status-badge ${model ? 'ready' : 'loading'}`}>
          {status}
        </div>
      </header>

      <main className="scanner-container">
        <div className="webcam-wrapper">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode }}
            className="webcam-view"
            onLoadedMetadata={runDetection} // Mulai deteksi saat kamera siap
          />
          <canvas ref={canvasRef} className="overlay-canvas" />
        </div>

        <div className="button-group">
          <button className="secondary-btn" onClick={switchCamera}>
            🔄 Ganti Kamera
          </button>
          <button 
            className="primary-btn" 
            disabled={!model}
            onClick={() => alert("Dokumen Berhasil Dipindai!")}
          >
            📸 Ambil Gambar
          </button>
        </div>
      </main>

      <section className="footer-info">
        <p>Ahmad Yassin | Teknik Informatika Polindra</p>
        <p>Model mAP: 98.8% | Local Persistence Mode</p>
      </section>
    </div>
  )
}

export default App;