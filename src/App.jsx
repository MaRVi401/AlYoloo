import { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import './App.css';

// Components
import Menu from './components/Menu';
import ImageCropper from './components/ImageCropper';

gsap.registerPlugin(useGSAP);

function App() {
  const [view, setView] = useState('menu'); // 'menu' | 'upload'
  const [model, setModel] = useState(null);
  const [modelStatus, setModelStatus] = useState('Memuat AI...');
  const [imageFile, setImageFile] = useState(null);

  // Load Model Sekali saat App Start
  useEffect(() => {
    const initModel = async () => {
      try {
        const loadedModel = await tf.loadGraphModel('/model/model.json');
        
        // Warmup agar deteksi pertama cepat
        const dummy = tf.zeros([1, 640, 640, 3]);
        await loadedModel.executeAsync(dummy);
        dummy.dispose();

        setModel(loadedModel);
        setModelStatus('AI Siap Digunakan');
      } catch (err) {
        setModelStatus('Gagal memuat model AI');
        console.error("TFJS Error:", err);
      }
    };
    initModel();
  }, []);

  const handleFileSelect = (file) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImageFile(url);
      setView('upload');
    }
  };

  const handleBack = () => {
    setView('menu');
    setImageFile(null);
  };

  return (
    <div className="app-container">
      {view === 'menu' ? (
        <Menu 
          modelStatus={modelStatus} 
          isModelReady={!!model} 
          onFileSelect={handleFileSelect} 
        />
      ) : (
        <ImageCropper 
          imageSrc={imageFile} 
          model={model} 
          onBack={handleBack} 
        />
      )}
    </div>
  );
}

export default App;