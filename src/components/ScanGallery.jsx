import { useState, useEffect } from 'react';
import { db } from '../db/database';

const ScanGallery = ({ refreshTick }) => {
  const [scans, setScans] = useState([]);

  useEffect(() => {
    const loadScans = async () => {
      const allScans = await db.scans.orderBy('timestamp').reverse().toArray();
      setScans(allScans);
    };
    loadScans();
  }, [refreshTick]); // Refresh galeri saat ada scan baru

  if (scans.length === 0) return null;

  return (
    <section className="gallery-section">
      <h3>Hasil Pindaian Terakhir</h3>
      <div className="gallery-grid">
        {scans.map((scan) => (
          <div key={scan.id} className="scan-card">
            <img src={URL.createObjectURL(scan.imageBlob)} alt="Scan" />
            <span>{new Date(scan.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ScanGallery;