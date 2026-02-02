import cv from "@techstark/opencv-js";
import { jsPDF } from "jspdf";

export const processDocument = (imageElement, points) => {
  try {
    let src = cv.imread(imageElement);
    
    // Pastikan points adalah array float
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, points);

    // Hitung dimensi kertas
    const tl = { x: points[0], y: points[1] };
    const tr = { x: points[2], y: points[3] };
    const br = { x: points[4], y: points[5] };
    const bl = { x: points[6], y: points[7] };

    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const maxWidth = Math.max(widthBottom, widthTop);

    const heightRight = Math.hypot(tr.x - br.x, tr.y - br.y);
    const heightLeft = Math.hypot(tl.x - bl.x, tl.y - bl.y);
    const maxHeight = Math.max(heightRight, heightLeft);

    // Output tujuan (tegak lurus)
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      maxWidth - 1, 0,
      maxWidth - 1, maxHeight - 1,
      0, maxHeight - 1
    ]);

    // Warp
    let dst = new cv.Mat();
    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    // Render ke Canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = maxWidth;
    outputCanvas.height = maxHeight;
    cv.imshow(outputCanvas, dst);

    // Cleanup
    src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();

    return outputCanvas;
  } catch (err) {
    console.error("OpenCV Error:", err);
    return null;
  }
};

export const generatePDF = (canvas) => {
  if (!canvas) throw new Error("Canvas tidak valid");
  const imgData = canvas.toDataURL("image/jpeg", 0.9);
  
  const orientation = canvas.width > canvas.height ? 'l' : 'p';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();
  
  const props = doc.getImageProperties(imgData);
  const ratio = props.width / props.height;
  
  let w = pdfW;
  let h = w / ratio;
  if (h > pdfH) {
    h = pdfH;
    w = h * ratio;
  }
  
  doc.addImage(imgData, 'JPEG', (pdfW - w)/2, (pdfH - h)/2, w, h);
  return doc.output('blob');
};