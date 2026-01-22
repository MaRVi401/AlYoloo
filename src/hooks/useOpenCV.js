import { useState, useEffect } from 'react';

export const useOpenCV = () => {
  const [isCvReady, setIsCvReady] = useState(false);

  useEffect(() => {
    const checkCV = () => {
      if (window.cv && window.cv.Mat) {
        setIsCvReady(true);
        console.log('OpenCV.js is ready');
      } else {
        // Cek kembali dalam 500ms jika belum siap
        setTimeout(checkCV, 500);
      }
    };

    checkCV();
  }, []);

  return isCvReady;
};