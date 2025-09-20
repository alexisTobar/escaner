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

// 🚀 3. Detectar carta y leer título o texto
async function detectCardAndRead() {
  try {
    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // Mejorar contraste y binarización
    let blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(5,5),0);
    let thresh = new cv.Mat();
    cv.adaptiveThreshold(blur, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 10);

    // Detectar bordes
    let edges = new cv.Mat();
    cv.Canny(thresh, edges, 100, 200);

    // Contornos
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

    let ocrText = "";

    if (biggestContour && maxArea > 50000) {
      let rect = cv.boundingRect(biggestContour);
      let card = src.roi(rect);

      // 🔹 Zona superior: título (25%)
      let nameHeight = Math.floor(card.rows * 0.25);
      let nameRect = new cv.Rect(0,0,card.cols,nameHeight);
      let nameRegion = card.roi(nameRect);

      // Canvas temporal
      let cardCanvas = document.createElement("canvas");
      cv.imshow(cardCanvas, nameRegion);

      // OCR título
      const { data: { text } } = await Tesseract.recognize(cardCanvas, "eng");
      ocrText = text.replace(/\n/g," ").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g,"").trim();

      nameRegion.delete();
      card.delete();

      // Si el OCR del nombre falla, usar backup: buscar por fragmento del texto detectado
      if (ocrText.length < 2) {
        // zona media de la carta (habilidades)
        let textHeight = Math.floor(card.rows * 0.5);
        let textRect = new cv.Rect(0, nameHeight, card.cols, textHeight);
        let textRegion = card.roi(textRect);
        let textCanvas = document.createElement("canvas");
        cv.imshow(textCanvas, textRegion);
        const { data: { text: t } } = await Tesseract.recognize(textCanvas, "eng");
        ocrText = t.replace(/\n/g," ").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g,"").trim();
        textRegion.delete();
      }

      if (ocrText.length > 2 && ocrText !== lastText) {
        lastText = ocrText;
        ocrTextEl.textContent = ocrText;
        buscarEnScryfall(ocrText);
      }
    }

    src.delete(); gray.delete(); blur.delete(); thresh.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  } catch(e){
    console.error(e);
  } finally {
    processing = false;
  }
}

// 🚀 4. Buscar en Scryfall
async function buscarEnScryfall(query) {
  try {
    // Primero buscar por nombre
    let url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}&lang=es`;
    let res = await fetch(url);
    if (!res.ok) {
      // fallback: buscar por texto/oracle
      url = `https://api.scryfall.com/cards/search?q=oracle:"${encodeURIComponent(query)}"&lang=es`;
      res = await fetch(url);
      if (!res.ok) throw new Error("Carta no encontrada");
      const dataSearch = await res.json();
      if (dataSearch.data && dataSearch.data.length>0) mostrarCarta(dataSearch.data[0]);
      else throw new Error("Carta no encontrada");
    } else {
      const data = await res.json();
      mostrarCarta(data);
    }
  } catch(err){
    cardResult.innerHTML = `<p style="color:red">❌ No se encontró carta</p>`;
  }
}

// 🚀 5. Mostrar carta
function mostrarCarta(data){
  cardResult.innerHTML = `
    <h3>${data.printed_name || data.name}</h3>
    <img src="${data.image_uris?.normal || data.image_uris?.small}" alt="${data.name}">
    <p><strong>Tipo:</strong> ${data.printed_type_line || data.type_line}</p>
    <p><strong>Texto:</strong><br>${data.printed_text || data.oracle_text || "Sin texto"}</p>
  `;
}

startCamera();
video.addEventListener("playing", loopScanner);




