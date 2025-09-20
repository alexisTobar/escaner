const video = document.getElementById("video");
const frameCanvas = document.getElementById("frameCanvas");
const procCanvas = document.getElementById("procCanvas");
const captureBtn = document.getElementById("capture");
const ocrTextEl = document.getElementById("ocrText");
const cardResult = document.getElementById("cardResult");

// 🚀 1. Abrir cámara
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = stream;
  } catch (err) {
    alert("Error cámara: " + err);
  }
}

// 🚀 2. Capturar y detectar carta con OpenCV
captureBtn.addEventListener("click", async () => {
  const w = video.videoWidth, h = video.videoHeight;
  frameCanvas.width = w; frameCanvas.height = h;
  frameCanvas.getContext("2d").drawImage(video, 0, 0, w, h);

  let src = cv.imread(frameCanvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

  let edges = new cv.Mat();
  cv.Canny(gray, edges, 75, 200);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  let maxArea = 0, best = null;
  for (let i = 0; i < contours.size(); i++) {
    let cnt = contours.get(i);
    let peri = cv.arcLength(cnt, true);
    let approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
    if (approx.rows === 4) {
      let area = cv.contourArea(approx);
      if (area > maxArea) {
        maxArea = area;
        best = approx.clone();
      }
    }
    cnt.delete(); approx.delete();
  }

  let warped;
  if (best) {
    let pts = [];
    for (let i = 0; i < 4; i++) {
      pts.push({ x: best.intPtr(0, i*2)[0], y: best.intPtr(0, i*2+1)[0] });
    }
    // Ordenar puntos (TL, TR, BR, BL)
    pts.sort((a, b) => a.y - b.y);
    let [tl, tr] = pts.slice(0,2).sort((a,b)=>a.x-b.x);
    let [bl, br] = pts.slice(2,4).sort((a,b)=>a.x-b.x);

    let dst = cv.matFromArray(4, 1, cv.CV_32FC2,
      [0,0, 300,0, 300,400, 0,400]);

    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2,
      [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);

    let M = cv.getPerspectiveTransform(srcTri, dst);
    warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(300, 400));

    cv.imshow(procCanvas, warped);
    M.delete(); dst.delete(); srcTri.delete();
  } else {
    cv.imshow(procCanvas, src); // fallback: solo mostrar frame
    warped = src.clone();
  }

  // 🚀 3. Pasar el recorte a OCR
  ocrTextEl.textContent = "Leyendo carta con OCR...";
  await doOCR(procCanvas);

  // liberar
  src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  if (best) best.delete();
  warped.delete();
});

// 🚀 4. OCR con Tesseract.js
async function doOCR(canvas) {
  const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
  const cleanText = text.replace(/\n/g, " ").trim();
  ocrTextEl.textContent = cleanText || "No se detectó texto.";
  if (cleanText.length > 0) buscarEnScryfall(cleanText);
}

// 🚀 5. Buscar en Scryfall
async function buscarEnScryfall(nombre) {
  try {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nombre)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Carta no encontrada");
    const data = await res.json();
    mostrarCarta(data);
  } catch (err) {
    cardResult.innerHTML = `<p style="color:red">❌ No se encontró carta: ${err.message}</p>`;
  }
}

// 🚀 6. Mostrar resultado
function mostrarCarta(data) {
  cardResult.innerHTML = `
    <h3>${data.name}</h3>
    <img src="${data.image_uris?.normal || data.image_uris?.small}" alt="${data.name}">
    <p><strong>Tipo:</strong> ${data.type_line}</p>
    <p><strong>Texto:</strong><br>${data.oracle_text || "Sin texto"}</p>
  `;
}

startCamera();

