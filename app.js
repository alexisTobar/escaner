const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const ocrTextEl = document.getElementById("ocrText");
const cardResult = document.getElementById("cardResult");

let processing = false;
let lastText = "";

// 🚀 1. Acceder a cámara
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

// 🚀 2. Bucle automático
function loopScanner() {
  if (!processing && video.readyState === video.HAVE_ENOUGH_DATA) {
    processing = true;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    detectCardAndRead();
  }
  requestAnimationFrame(loopScanner);
}

// 🚀 3. Detectar carta con OpenCV y pasar a OCR
async function detectCardAndRead() {
  try {
    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // Detectar bordes
    let edges = new cv.Mat();
    cv.Canny(gray, edges, 100, 200);

    // Encontrar contornos
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let biggestContour = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt);
      if (area > maxArea) {
        maxArea = area;
        biggestContour = cnt;
      }
    }

    if (biggestContour && maxArea > 50000) { // filtrar ruido
      let rect = cv.boundingRect(biggestContour);

      // recortar carta
      let card = src.roi(rect);

      // convertir a canvas temporal
      let cardCanvas = document.createElement("canvas");
      cv.imshow(cardCanvas, card);

      // 🚀 OCR en recorte
      const { data: { text } } = await Tesseract.recognize(cardCanvas, "eng");
      const cleanText = text.replace(/\n/g, " ").trim();

      if (cleanText.length > 3 && cleanText !== lastText) {
        lastText = cleanText;
        ocrTextEl.textContent = cleanText;
        buscarEnScryfall(cleanText);
      }

      card.delete();
    }

    src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  } catch (e) {
    console.error(e);
  } finally {
    processing = false;
  }
}

// 🚀 4. Buscar en Scryfall en español
async function buscarEnScryfall(nombre) {
  try {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nombre)}&lang=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Carta no encontrada");
    const data = await res.json();
    mostrarCarta(data);
  } catch (err) {
    cardResult.innerHTML = `<p style="color:red">❌ No se encontró carta</p>`;
  }
}

// 🚀 5. Mostrar carta
function mostrarCarta(data) {
  cardResult.innerHTML = `
    <h3>${data.printed_name || data.name}</h3>
    <img src="${data.image_uris?.normal || data.image_uris?.small}" alt="${data.name}">
    <p><strong>Tipo:</strong> ${data.printed_type_line || data.type_line}</p>
    <p><strong>Texto:</strong><br>${data.printed_text || data.oracle_text || "Sin texto"}</p>
  `;
}

startCamera();
video.addEventListener("playing", loopScanner);


