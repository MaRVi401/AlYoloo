import { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { db } from '../db/database';
import { processDocument, generatePDF } from '../utils/imageProcessing';
import Swal from 'sweetalert2';

const ImageCropper = ({ imageSrc, model, onBack }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [loadingText, setLoadingText] = useState('Menyiapkan gambar...');

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // State untuk menyimpan titik potong
  const pointsRef = useRef([]);
  const activePointIdx = useRef(-1);

  // --- 1. INISIALISASI ---
  useGSAP(() => {
    gsap.from(containerRef.current, { opacity: 0, y: 20, duration: 0.5 });
  });

  const handleImageLoad = () => {
    // Tunggu layout stabil, lalu jalankan deteksi
    setLoadingText('Mendeteksi dokumen...');
    setTimeout(() => {
      syncCanvasSize(); // Pastikan ukuran canvas pas
      runDetection();
    }, 200);
  };

  // Fungsi PENTING: Menyamakan ukuran Canvas dengan Gambar di layar
  const syncCanvasSize = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    }
  };

  // Listener jika layar di-resize (agar canvas tidak melayang)
  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, []);

  // --- 2. DETEKSI AI ---
  const runDetection = async () => {
    if (!model || !imgRef.current) return;
    const img = imgRef.current;
    
    // Prediksi AI
    const tensor = tf.tidy(() => {
      const t = tf.browser.fromPixels(img);
      return tf.image.resizeBilinear(t, [640, 640]).expandDims(0).div(255.0);
    });

    const output = await model.executeAsync(tensor);
    const predictions = await output.array();
    
    // Cari skor tertinggi
    const scores = predictions[0][4];
    let maxScore = 0;
    let bestIdx = -1;
    for (let i = 0; i < 8400; i++) {
      if (scores[i] > maxScore) { maxScore = scores[i]; bestIdx = i; }
    }

    let detected = [];
    
    // Rumus Ratio: Resolusi Asli dibagi Resolusi Layar (PENTING!)
    const ratioX = img.naturalWidth / img.clientWidth;
    const ratioY = img.naturalHeight / img.clientHeight;

    if (maxScore > 0.25) {
      // Mapping dari 640px (Model) -> Resolusi Asli -> Resolusi Layar
      const scaleX = img.naturalWidth / 640;
      const scaleY = img.naturalHeight / 640;
      const rawCoords = [];

      for (let k = 0; k < 4; k++) {
        let x = predictions[0][5 + k * 3][bestIdx] * scaleX;
        let y = predictions[0][5 + k * 3 + 1][bestIdx] * scaleY;
        
        // Clamp (Batasi agar tidak keluar gambar)
        x = Math.max(0, Math.min(x, img.naturalWidth));
        y = Math.max(0, Math.min(y, img.naturalHeight));
        
        // Konversi ke koordinat layar untuk ditampilkan di Canvas
        rawCoords.push(x / ratioX, y / ratioY); 
      }
      detected = sortPoints(rawCoords);
    } else {
      // Fallback: Default Box 80%
      const w = img.clientWidth;
      const h = img.clientHeight;
      const pad = 40;
      detected = [
        { x: pad, y: pad }, 
        { x: w - pad, y: pad },
        { x: w - pad, y: h - pad }, 
        { x: pad, y: h - pad }
      ];
    }

    pointsRef.current = detected;
    draw(); // Gambar garis biru
    tf.dispose([tensor, output]);
    setIsProcessing(false);
  };

  const sortPoints = (rawFlat) => {
    const pts = [];
    for (let i = 0; i < 4; i++) pts.push({ x: rawFlat[i * 2], y: rawFlat[i * 2 + 1] });
    const center = pts.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 });
    center.x /= 4; center.y /= 4;
    const top = pts.filter(p => p.y < center.y).sort((a, b) => a.x - b.x);
    const bottom = pts.filter(p => p.y >= center.y).sort((a, b) => a.x - b.x);
    return [ top[0], top[1], bottom[1], bottom[0] ];
  };

  // --- 3. GAMBAR UI (CANVAS) ---
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pts = pointsRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (pts.length < 4) return;

    // Fill Area
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.4)'; // Warna Ungu Transparan
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#6366f1';
    ctx.stroke();

    // Corner Points
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, 2 * Math.PI); // Lingkaran besar biar gampang disentuh
      ctx.fillStyle = i === activePointIdx.current ? '#10b981' : 'white';
      ctx.fill();
      ctx.stroke();
    });
  };

  // --- 4. INTERAKSI TOUCH/MOUSE ---
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleStart = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    let closest = -1;
    let minDist = 60; // Radius sentuh besar
    pointsRef.current.forEach((p, i) => {
      const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    if (closest !== -1) { activePointIdx.current = closest; draw(); }
  };

  const handleMove = (e) => {
    e.preventDefault();
    if (activePointIdx.current === -1) return;
    
    const pos = getPos(e);
    const cvs = canvasRef.current;
    
    // Batasi agar titik tidak keluar area
    const x = Math.max(0, Math.min(pos.x, cvs.width));
    const y = Math.max(0, Math.min(pos.y, cvs.height));
    
    pointsRef.current[activePointIdx.current] = { x, y };
    requestAnimationFrame(draw);
  };

  const handleEnd = () => {
    activePointIdx.current = -1;
    draw();
  };

  // --- 5. SIMPAN PDF ---
  const handleSave = async () => {
    setIsProcessing(true);
    setLoadingText('Memproses PDF...');

    try {
      const img = imgRef.current;
      
      // --- LOGIC UTAMA FIX CROP ---
      // Hitung skala: Berapa kali lipat gambar asli lebih besar dari layar?
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      
      console.log(`Layar: ${img.clientWidth}x${img.clientHeight}, Asli: ${img.naturalWidth}x${img.naturalHeight}`);
      console.log(`Scale Factor: ${scaleX}, ${scaleY}`);

      // Kalikan koordinat layar dengan skala untuk dapat koordinat asli
      const naturalCoords = pointsRef.current.flatMap(p => [
        p.x * scaleX, 
        p.y * scaleY
      ]);

      const croppedCanvas = processDocument(img, naturalCoords);

      if (croppedCanvas) {
        const pdfBlob = generatePDF(croppedCanvas);
        
        // Save to DB
        await db.scans.add({
          imageBlob: pdfBlob,
          timestamp: new Date(),
          type: 'application/pdf'
        });

        // Download
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Scan-${Date.now()}.pdf`;
        link.click();
        
        Swal.fire({
          icon: 'success',
          title: 'Selesai!',
          text: 'PDF berhasil disimpan.',
          confirmButtonColor: '#10b981',
          background: '#1e293b',
          color: '#fff'
        }).then((res) => { if(res.isConfirmed) onBack(); });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message, background: '#1e293b', color: '#fff' });
    }
    setIsProcessing(false);
  };

  // --- 6. RENDER (GRID STACK LAYOUT) ---
  return (
    <div className="editor-container" ref={containerRef} style={{ 
      display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '95vh', overflow: 'hidden' 
    }}>
      
      {/* HEADER */}
      <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'white', margin: 0 }}>Edit Scan</h2>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>Batal</button>
      </div>

      {/* AREA KERJA (GRID STACK) */}
      <div style={{ 
        flex: 1, 
        background: '#0f172a', 
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'grid',          // KUNCI: Grid Layout
        placeItems: 'center',     // KUNCI: Center isi
        position: 'relative'
      }}>
        
        {/* WRAPPER yang menumpuk Gambar & Canvas di sel yang sama */}
        <div style={{ 
          position: 'relative', 
          maxWidth: '100%', 
          maxHeight: '70vh', 
          lineHeight: 0 // Hapus gap bawah gambar
        }}>
          
          {/* GAMBAR */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Original"
            onLoad={handleImageLoad}
            style={{ 
              display: 'block',
              maxWidth: '100%', 
              maxHeight: '70vh', 
              width: 'auto', 
              height: 'auto',
              pointerEvents: 'none' // Biar tidak bisa di-drag gambar-nya
            }}
          />

          {/* CANVAS (Overlay Mutlak) */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
            onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
            style={{
              position: 'absolute', // Menumpuk di atas gambar
              top: 0, left: 0,
              width: '100%', height: '100%',
              zIndex: 10,
              cursor: 'crosshair',
              touchAction: 'none' // Fix scroll di HP
            }}
          />

          {/* LOADING SPINNER */}
          {isProcessing && (
            <div style={{
              position: 'absolute', inset: 0, 
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 20, color: 'white', backdropFilter: 'blur(4px)'
            }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '10px' }}>{loadingText}</p>
            </div>
          )}

        </div>
      </div>

      {/* FOOTER BUTTONS */}
      <div style={{ marginTop: '15px' }}>
         <button 
           onClick={handleSave} 
           disabled={isProcessing}
           style={{
             width: '100%', padding: '15px', borderRadius: '12px',
             background: 'var(--primary, #6366f1)', color: 'white',
             border: 'none', fontSize: '1rem', fontWeight: 'bold',
             opacity: isProcessing ? 0.7 : 1, cursor: isProcessing ? 'wait' : 'pointer'
           }}
         >
           {isProcessing ? 'Sedang Memproses...' : '💾 Simpan & Download PDF'}
         </button>
      </div>

    </div>
  );
};

export default ImageCropper;