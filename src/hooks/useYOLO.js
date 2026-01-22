import { useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';

export const useYOLO = (modelPath) => {
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState('Memuat Model...');

  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await tf.loadGraphModel(modelPath);
        setModel(loadedModel);
        setStatus('Sistem Siap');
      } catch (e) {
        setStatus('Gagal memuat model');
      }
    };
    loadModel();
  }, [modelPath]);

  return { model, status };
};