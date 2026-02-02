import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import Swal from 'sweetalert2'; // Import SweetAlert

const Menu = ({ modelStatus, isModelReady, onFileSelect }) => {
  const containerRef = useRef(null); // Ref untuk scope animasi
  const inputRef = useRef(null);

  // Animasi dengan Scope agar selector pasti ketemu
  useGSAP(() => {
    const tl = gsap.timeline();
    
    tl.from('.title-content', { 
      y: -50, 
      opacity: 0, 
      duration: 1, 
      ease: 'power3.out' 
    })
    .from('.btn-anim', { 
      y: 50, 
      opacity: 0, 
      stagger: 0.15, 
      duration: 0.8, 
      ease: 'back.out(1.7)' 
    }, "-=0.5");
    
  }, { scope: containerRef }); // Scope penting agar element ditemukan!

  const handleChange = (e) => {
    if (e.target.files?.[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleCameraClick = () => {
    // SweetAlert Custom
    Swal.fire({
      icon: 'info',
      title: 'Segera Hadir!',
      text: 'Fitur kamera langsung sedang dalam tahap pengembangan.',
      confirmButtonText: 'Oke, Siap!',
      confirmButtonColor: '#6366f1',
      background: '#1e293b',
      color: '#fff'
    });
  };

  return (
    <div className="menu-view" ref={containerRef}>
      <div className="title-display title-content">
        <h1>DocScanner AI</h1>
        <div className="status-badge">
          {isModelReady ? '🟢 ' : '🟠 '} {modelStatus}
        </div>
      </div>

      {/* Tambahkan class 'btn-anim' untuk target animasi */}
      <div className="button-group">
        <button 
          className="btn btn-primary btn-anim"
          onClick={() => inputRef.current.click()}
          disabled={!isModelReady}
        >
          📂 Upload Dokumen
        </button>
        
        {/* Input file tetap hidden */}
        <input 
          type="file" 
          accept="image/*" 
          hidden 
          ref={inputRef}
          onChange={handleChange} 
        />
        
        <button 
          className="btn btn-secondary btn-anim" 
          onClick={handleCameraClick}
        >
          📷 Ambil Foto
        </button>
      </div>
    </div>
  );
};

export default Menu;