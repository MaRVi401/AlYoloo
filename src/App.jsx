import { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useYOLO } from './hooks/useYOLO';
import { useOpenCV } from './hooks/useOpenCV';
import { processDocument } from './utils/imageProcessing';
import { db } from './db/database';
import ScannerView from './components/ScannerView';
import ControlButtons from './components/ControlButtons';
import ScanGallery from './components/ScanGallery';
import './App.css';

function App() {
  const [facingMode, setFacingMode] = useState('environment');
  const [refreshGallery, setRefreshGallery] = useState(0);
  const [status, setStatus] = useState('Menginisialisasi...');
  
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lastCoordsRef = useRef([]);
  const requestRef = useRef();

  const isCvReady = useOpenCV();
  const { model, status: yoloStatus } = useYOLO('/model/model.json');

  // Logika Deteksi Real-time
  const runDetection = useCallback(async () => {
    if (model && webcamRef.current && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const { videoWidth, videoHeight } = video;

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      const tensor = tf.tidy(() => {
        const img = tf.browser.fromPixels(video);
        return tf.image.resizeBilinear(img, [640, 640])
          .expandDims(0)
          .div(255.0);
      });

      const predictions = await model.executeAsync(tensor);
      const data = await predictions.data();

      // Ambil 4 titik keypoints (x, y) saja, abaikan confidence score
      // YOLO pose mengembalikan [x, y, conf, x, y, conf, ...]
      const coords = [];
      for (let i = 0; i < 4; i++) {
        coords.push(data[i * 3] * (videoWidth / 640));
        coords.push(data[i * 3 + 1] * (videoHeight / 640));
      }
      lastCoordsRef.current = coords;

      renderCanvas(coords, videoWidth, videoHeight);

      tensor.dispose();
      predictions.dispose();
    }
    requestRef.current = requestAnimationFrame(runDetection);
  }, [model]);

  const renderCanvas = (coords, width, height) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i];
      const y = coords[i + 1];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      ctx.fillStyle = "#FF0000";
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
    ctx.closePath();
    ctx.stroke();
  };

  useEffect(() => {
    if (model) {
      requestRef.current = requestAnimationFrame(runDetection);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [model, runDetection]);

  const handleCapture = async () => {
    if (!model || !webcamRef.current) return;

    const canvas = processDocument(
      webcamRef.current.video,
      lastCoordsRef.current
    );

    if (canvas) {
      canvas.toBlob(async (blob) => {
        await db.scans.add({ imageBlob: blob, timestamp: new Date() });
        setRefreshGallery(prev => prev + 1);
        alert("Dokumen berhasil disimpan!");
      }, 'image/jpeg');
    }
  };

  return (
    <div className="container">
      <header>
        <h1>AI DocScanner v1.0</h1>
        <div className={`status-badge ${model && isCvReady ? 'ready' : 'loading'}`}>
          {yoloStatus} {isCvReady ? '| CV Ready' : '| Loading CV...'}
        </div>
      </header>

      <main className="scanner-container">
        <ScannerView 
          ref={webcamRef} 
          canvasRef={canvasRef} 
          facingMode={facingMode} 
          onLoadedMetadata={() => {}} // Sekarang dikontrol oleh useEffect
        />
        
        <ControlButtons 
          onCapture={handleCapture} 
          onSwitchCamera={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')} 
          isLoading={!model}
        />

        <ScanGallery refreshTick={refreshGallery} />
      </main>

      <footer className="footer-info">
        <p>Ahmad Yassin | Teknik Informatika Polindra</p>
      </footer>
    </div>
  );
}

export default App;