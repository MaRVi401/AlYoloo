import { useState, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { db } from '../db/database';
import { processDocument, generatePDF } from '../utils/imageProcessing';
import Swal from 'sweetalert2';

const ImageCropper = ({ imageSrc, model, onBack }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [loadingText, setLoadingText] = useState('Mendeteksi dokumen...');

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Logic Refs
  const pointsRef = useRef([]);
  const activePointIdx = useRef(-1);

  useGSAP(() => {
    gsap.from(containerRef.current, { opacity: 0, scale: 0.95, duration: 0.4 });
  });

  const handleImageLoad = () => {
    // Tunggu sebentar agar layout HTML stabil
    setTimeout(() => {
        runDetection();
    }, 200);
  };

  const runDetection = async () => {
    if (!model || !imgRef.current) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;

    // 1. Pastikan ukuran Canvas SAMA PERSIS dengan Gambar yang dirender
    // Karena kita menghapus object-fit, img.width sekarang adalah lebar visual asli
    canvas.width = img.width; 
    canvas.height = img.height;

    // 2. Hitung Rasio (Natural vs Rendered)
    const ratioX = img.naturalWidth / img.width;
    const ratioY = img.naturalHeight / img.height;

    // AI Prediction
    const tensor = tf.tidy(() => {
      const t = tf.browser.fromPixels(img);
      return tf.image.resizeBilinear(t, [640, 640]).expandDims(0).div(255.0);
    });

    const output = await model.executeAsync(tensor);
    const predictions = await output.array();
    
    // Cari box dengan score tertinggi
    const scores = predictions[0][4];
    let maxScore = 0;
    let bestIdx = -1;
    for (let i = 0; i < 8400; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i];
        bestIdx = i;
      }
    }

    let detected = [];

    if (maxScore > 0.25) {
      // Mapping: YOLO (640) -> Natural -> Rendered
      const scaleX = img.naturalWidth / 640;
      const scaleY = img.naturalHeight / 640;
      const rawCoords = [];

      for (let k = 0; k < 4; k++) {
        let x = predictions[0][5 + k * 3][bestIdx] * scaleX;
        let y = predictions[0][5 + k * 3 + 1][bestIdx] * scaleY;
        
        // Clamp ke batas natural
        x = Math.max(0, Math.min(x, img.naturalWidth));
        y = Math.max(0, Math.min(y, img.naturalHeight));
        
        // Konversi ke koordinat layar (dibagi rasio)
        rawCoords.push(x / ratioX, y / ratioY); 
      }
      detected = sortPoints(rawCoords);
    } else {
      // Fallback Default
      const padX = img.width * 0.15;
      const padY = img.height * 0.15;
      detected = [
        { x: padX, y: padY },
        { x: img.width - padX, y: padY },
        { x: img.width - padX, y: img.height - padY },
        { x: padX, y: img.height - padY }
      ];
    }

    pointsRef.current = detected;
    draw();

    tf.dispose([tensor, output]);
    setIsProcessing(false);
  };

  // Helper: Sort Clockwise (TL, TR, BR, BL)
  const sortPoints = (rawFlat) => {
    const pts = [];
    for (let i = 0; i < 4; i++) pts.push({ x: rawFlat[i * 2], y: rawFlat[i * 2 + 1] });

    const center = pts.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 });
    center.x /= 4; center.y /= 4;

    const top = pts.filter(p => p.y < center.y).sort((a, b) => a.x - b.x);
    const bottom = pts.filter(p => p.y >= center.y).sort((a, b) => a.x - b.x);

    // Order: Top-Left, Top-Right, Bottom-Right, Bottom-Left
    return [
      top[0] || { x: 0, y: 0 },
      top[1] || { x: 100, y: 0 },
      bottom[1] || { x: 100, y: 100 },
      bottom[0] || { x: 0, y: 100 }
    ];
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pts = pointsRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#6366f1';
    ctx.stroke();

    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = i === activePointIdx.current ? '#10b981' : '#ffffff';
      ctx.fill();
      ctx.stroke();
    });
  };

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
    let minDist = 40; // Hit radius

    pointsRef.current.forEach((p, i) => {
      const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });

    if (closest !== -1) {
      activePointIdx.current = closest;
      draw();
    }
  };

  const handleMove = (e) => {
    e.preventDefault();
    if (activePointIdx.current === -1) {
        // Hover effect logic
        const pos = getPos(e);
        const isHover = pointsRef.current.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 20);
        if(canvasRef.current) canvasRef.current.style.cursor = isHover ? 'grab' : 'default';
        return;
    }

    const pos = getPos(e);
    const cvs = canvasRef.current;
    
    const x = Math.max(0, Math.min(pos.x, cvs.width));
    const y = Math.max(0, Math.min(pos.y, cvs.height));

    pointsRef.current[activePointIdx.current] = { x, y };
    requestAnimationFrame(draw);
  };

  const handleEnd = () => {
    activePointIdx.current = -1;
    if(canvasRef.current) canvasRef.current.style.cursor = 'default';
    draw();
  };

  const handleSave = async () => {
    setIsProcessing(true);
    setLoadingText('Memproses PDF...');

    try {
      const img = imgRef.current;
      // HITUNG RASIO FINAL SEBELUM SAVE
      // Penting: Mengubah koordinat layar (kecil) kembali ke resolusi asli (besar)
      const ratioX = img.naturalWidth / img.width;
      const ratioY = img.naturalHeight / img.height;
      
      const naturalCoords = pointsRef.current.flatMap(p => [p.x * ratioX, p.y * ratioY]);

      console.log("Coords Original:", pointsRef.current);
      console.log("Coords Natural:", naturalCoords);

      const croppedCanvas = processDocument(img, naturalCoords);

      if (croppedCanvas) {
        const pdfBlob = generatePDF(croppedCanvas);

        await db.scans.add({
          imageBlob: pdfBlob,
          timestamp: new Date(),
          type: 'application/pdf'
        });

        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Scan-${Date.now()}.pdf`;
        link.click();
        
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'PDF tersimpan.',
          confirmButtonColor: '#10b981',
          background: '#1e293b',
          color: '#fff'
        }).then((res) => {
           if(res.isConfirmed) onBack();
        });
      } else {
          throw new Error("Gagal crop canvas");
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal memproses gambar', background: '#1e293b', color: '#fff' });
    }
    setIsProcessing(false);
  };

  // --- RENDER STYLE FIX ---
  // Kita menghapus object-fit: contain dan menggunakan wrapper width: fit-content
  // agar koordinat mouse 100% akurat terhadap gambar.

  return (
    <div className="editor-container" ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '95vh' }}>
      
      <div className="editor-header" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>Sesuaikan Area</h2>
        <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={onBack}>✕</button>
      </div>

      {/* WRAPPER UTAMA: Menggunakan Flex center agar gambar ada di tengah */}
      <div className="canvas-card" style={{ 
          flex: 1, 
          position: 'relative', 
          overflow: 'hidden', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          background: '#0f172a',
          borderRadius: '16px'
      }}>
        
        {/* WRAPPER GAMBAR: width fit-content agar 'membungkus' gambar sesuai ukuran aslinya */}
        <div style={{ position: 'relative', width: 'fit-content', height: 'fit-content', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
          
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Original"
            onLoad={handleImageLoad}
            style={{ 
                display: 'block',
                maxWidth: '100%',     // Responsif lebar
                maxHeight: '70vh',    // Batasi tinggi agar tombol tidak hilang
                width: 'auto',        // Biarkan rasio natural
                height: 'auto',       // Biarkan rasio natural
                // objectFit HAPUS -> Ini biang kerok koordinat meleset
            }}
          />

          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',   // Ikuti ukuran wrapper (yang sudah fit-content ke img)
                height: '100%',
                zIndex: 10,
                touchAction: 'none'
            }}
          />
          
          {isProcessing && (
            <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                zIndex: 20, color: 'white', backdropFilter: 'blur(5px)'
            }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{loadingText}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '15px' }}>
         <div className="bottom-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onBack}>
            Ulangi
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={isProcessing}>
            💾 Simpan PDF
          </button>
        </div>
      </div>

    </div>
  );
};

export default ImageCropper;