import { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import Webcam from 'react-webcam';
import { db } from './db/database';
import { processDocument, generatePDF } from './utils/imageProcessing';
import './App.css';

function App() {
  const [model, setModel] = useState(null);
  const [isCvReady, setIsCvReady] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lastCoordsRef = useRef([]);

  // Load Model & OpenCV
  useEffect(() => {
    const init = async () => {
      const loadedModel = await tf.loadGraphModel('/model/model.json');
      setModel(loadedModel);
      if (window.cv) setIsCvReady(true);
    };
    init();
  }, []);

  const runDetection = useCallback(async () => {
    if (model && webcamRef.current?.video.readyState === 4) {
      const video = webcamRef.current.video;
      const { videoWidth, videoHeight } = video;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      const tensor = tf.tidy(() => {
        const img = tf.browser.fromPixels(video);
        return tf.image.resizeBilinear(img, [640, 640]).expandDims(0).div(255.0);
      });

      const output = await model.executeAsync(tensor);
      const predictions = await output.array(); // [1, 17, 8400]
      
      // Post-processing: Cari deteksi dengan score tertinggi
      let maxScore = 0;
      let bestIdx = -1;
      const scores = predictions[0][4]; // Score box di index 4
      for(let i=0; i<8400; i++) {
        if(scores[i] > maxScore) {
          maxScore = scores[i];
          bestIdx = i;
        }
      }

      if (maxScore > 0.5) {
        const coords = [];
        // Ambil 4 keypoints (x, y) dari index 5-16
        for (let k = 0; k < 4; k++) {
          const x = predictions[0][5 + k * 3][bestIdx] * (videoWidth / 640);
          const y = predictions[0][5 + k * 3 + 1][bestIdx] * (videoHeight / 640);
          coords.push(x, y);
        }
        lastCoordsRef.current = coords;
        drawOverlay(coords);
      }

      tf.dispose([tensor, output]);
    }
    requestAnimationFrame(runDetection);
  }, [model]);

  const drawOverlay = (coords) => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(coords[0], coords[1]);
    ctx.lineTo(coords[2], coords[3]);
    ctx.lineTo(coords[4], coords[5]);
    ctx.lineTo(coords[6], coords[7]);
    ctx.closePath();
    ctx.stroke();
  };

  const handleCapture = async () => {
    if (lastCoordsRef.current.length === 8) {
      const croppedCanvas = processDocument(webcamRef.current.video, lastCoordsRef.current);
      if (croppedCanvas) {
        const pdfBlob = generatePDF(croppedCanvas);
        await db.scans.add({ 
          imageBlob: pdfBlob, 
          timestamp: new Date(), 
          type: 'application/pdf' 
        });
        alert("Berhasil! PDF tersimpan di database lokal.");
        setRefresh(r => r + 1);
      }
    } else {
      alert("Arahkan kamera sampai kotak hijau muncul!");
    }
  };

  return (
    <div className="container">
      <h1>AI DocScanner v1.0</h1>
      <div className="webcam-wrapper">
        <Webcam 
          ref={webcamRef} 
          onLoadedMetadata={runDetection} 
          videoConstraints={{ facingMode: 'environment' }} 
        />
        <canvas ref={canvasRef} className="overlay-canvas" />
      </div>
      <button className="primary-btn" onClick={handleCapture}>📸 Ambil & Simpan PDF</button>
      <p>Status: {model && isCvReady ? "Sistem Siap" : "Memuat..."}</p>
    </div>
  );
}

export default App;