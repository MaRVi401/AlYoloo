import { Camera, RefreshCw } from 'lucide-react';

const ControlButtons = ({ onCapture, onSwitchCamera, isLoading }) => {
  return (
    <div className="button-group">
      <button className="secondary-btn" onClick={onSwitchCamera}>
        <RefreshCw size={20} /> Ganti Kamera
      </button>
      <button 
        className="primary-btn" 
        onClick={onCapture} 
        disabled={isLoading}
      >
        <Camera size={20} /> {isLoading ? 'Memproses...' : 'Ambil Gambar'}
      </button>
    </div>
  );
};

export default ControlButtons;