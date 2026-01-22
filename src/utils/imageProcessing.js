import { jsPDF } from "jspdf";

export const processDocument = (videoElement, coords, outWidth = 600, outHeight = 848) => {
  if (!window.cv || !coords || coords.length < 8) return null;

  const cv = window.cv;
  let src = cv.imread(videoElement);
  let dst = new cv.Mat();

  // Koordinat sumber dari AI (4 titik sudut)
  let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, coords);

  // Koordinat tujuan (Rasio A4)
  let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, outWidth, 0, outWidth, outHeight, 0, outHeight
  ]);

  // Warp Perspective (Auto-Crop)
  let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
  let dsize = new cv.Size(outWidth, outHeight);
  cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  // Enhancement (B&W Filter)
  cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
  cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

  const canvas = document.createElement('canvas');
  cv.imshow(canvas, dst);

  // Cleanup
  src.delete(); dst.delete(); M.delete(); srcCoords.delete(); dstCoords.delete();
  return canvas;
};

export const generatePDF = (canvas) => {
  const imgData = canvas.toDataURL('image/jpeg', 1.0);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
};