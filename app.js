const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const cardResult = document.getElementById("cardResult");
const historyDiv = document.getElementById("history");

let history = JSON.parse(localStorage.getItem("mtgHistory")) || [];

// Mostrar historial en galería
function mostrarHistorial() {
  historyDiv.innerHTML = "";
  if(history.length === 0) {
    historyDiv.innerHTML = "<p>No hay cartas buscadas todavía.</p>";
    return;
  }
  history.forEach((card, index) => {
    const div = document.createElement("div");
    div.classList.add("card");
    div.innerHTML = `
      <h3>${card.name}</h3>
      <img src="${card.image}" alt="${card.name}">
      <p><strong>Tipo:</strong> ${card.type}</p>
    `;
    div.querySelector("img").addEventListener("click", () => {
      mostrarCarta(card);
    });
    historyDiv.appendChild(div);
  });
}

// Traducir texto usando LibreTranslate
async function traducir(texto, source='en', target='es') {
  try {
    const res = await fetch('https://libretranslate.de/translate', {
      method:'POST',
      body: JSON.stringify({
        q: texto,
        source: source,
        target: target,
        format: "text"
      }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    return data.translatedText;
  } catch (e) {
    console.error("Error traducción:", e);
    return texto; 
  }
}

// Buscar carta en Scryfall
async function buscarCarta(nombre) {
  try {
    let url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nombre)}&lang=es`;
    let res = await fetch(url);
    let data;
    if(res.ok){
      data = await res.json(); // versión en español disponible
    } else {
      // fallback: buscar en inglés y traducir
      url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nombre)}&lang=en`;
      res = await fetch(url);
      if(!res.ok) throw new Error("Carta no encontrada");
      data = await res.json();

      // traducir nombre, tipo y texto
      data.printed_name = await traducir(data.name);
      data.printed_type_line = data.type_line ? await traducir(data.type_line) : "";
      data.printed_text = data.oracle_text ? await traducir(data.oracle_text) : "";
    }
    mostrarCarta(data);
    guardarHistorial(data);
  } catch(err) {
    cardResult.innerHTML = `<p style="color:red">❌ No se encontró la carta "${nombre}"</p>`;
  }
}

// Mostrar carta seleccionada
function mostrarCarta(data) {
  cardResult.innerHTML = "";
  const div = document.createElement("div");
  div.classList.add("card");
  div.innerHTML = `
    <h3>${data.printed_name || data.name}</h3>
    <img src="${data.image_uris?.normal || data.image_uris?.small}" alt="${data.name}">
    <p><strong>Tipo:</strong> ${data.printed_type_line || data.type_line}</p>
    <p><strong>Texto:</strong><br>${data.printed_text || data.oracle_text || "Sin texto"}</p>
  `;
  cardResult.appendChild(div);
}

// Guardar carta en historial
function guardarHistorial(data) {
  const cardData = {
    name: data.printed_name || data.name,
    image: data.image_uris?.normal || data.image_uris?.small,
    type: data.printed_type_line || data.type_line,
    text: data.printed_text || data.oracle_text || ""
  };
  if(!history.some(c => c.name === cardData.name)) {
    history.unshift(cardData);
    if(history.length > 20) history.pop();
    localStorage.setItem("mtgHistory", JSON.stringify(history));
    mostrarHistorial();
  }
}

// Eventos
searchButton.addEventListener("click", () => {
  const nombre = searchInput.value.trim();
  if(nombre) buscarCarta(nombre);
});

searchInput.addEventListener("keyup", (e) => {
  if(e.key === "Enter") {
    const nombre = searchInput.value.trim();
    if(nombre) buscarCarta(nombre);
  }
});

// Inicializar historial
mostrarHistorial();







