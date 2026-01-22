import React from 'react';
import Webcam from 'react-webcam';

const ScannerView = React.forwardRef(({ facingMode, onLoadedMetadata, canvasRef }, ref) => (
  <div className="webcam-wrapper">
    <Webcam
      ref={ref}
      audio={false}
      screenshotFormat="image/jpeg"
      videoConstraints={{ facingMode }}
      className="webcam-view"
      onLoadedMetadata={onLoadedMetadata}
    />
    <canvas ref={canvasRef} className="overlay-canvas" />
  </div>
));

export default ScannerView;