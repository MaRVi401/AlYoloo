export const processDocument = (videoElement, coords, outWidth = 600, outHeight = 848) => {
  if (!window.cv || !coords || coords.length < 8) return null;

  const cv = window.cv;
  let src = cv.imread(videoElement);
  let dst = new cv.Mat();

  // 1. Koordinat Sumber (dari AI)
  let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, coords);

  // 2. Koordinat Tujuan (Persegi Panjang Tegak)
  let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    outWidth, 0,
    outWidth, outHeight,
    0, outHeight
  ]);

  // 3. Transformasi Perspektif
  let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
  let dsize = new cv.Size(outWidth, outHeight);
  cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  // 4. Perbaikan Gambar (B&W Filter)
  cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
  cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

  // Simpan ke Canvas sementara untuk konversi ke Blob
  const tempCanvas = document.createElement('canvas');
  cv.imshow(tempCanvas, dst);

  // Cleanup memori C++ OpenCV
  src.delete(); dst.delete(); M.delete(); srcCoords.delete(); dstCoords.delete();

  return tempCanvas;
};