// --- Initial State ---
let items = JSON.parse(localStorage.getItem("stockly_items")) || [];
let locations = JSON.parse(localStorage.getItem("stockly_locs")) || [
  "キッチン",
  "洗面所",
  "パントリー",
];
let settings = JSON.parse(localStorage.getItem("stockly_sets")) || {
  theme: "natural",
};
let editingId = null;
let html5QrCode = null;

// --- Core Functions ---
function init() {
  setTheme(settings.theme);
  renderItems();
  renderLocations();
  lucide.createIcons();
}

function switchView(viewId) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${viewId}`).classList.add("active");
  document
    .querySelectorAll(".tab-item")
    .forEach((i) => i.classList.remove("active"));
  document.getElementById(`tab-${viewId}`).classList.add("active");
  if (viewId === "inventory") renderItems();
}

function setTheme(t) {
  document.body.className = `theme-${t}`;
  settings.theme = t;
  localStorage.setItem("stockly_sets", JSON.stringify(settings));
}

// --- Master Data (Locations) ---
function renderLocations() {
  // Settings Tags
  const tagBox = document.getElementById("location-tags");
  tagBox.innerHTML = locations
    .map(
      (l) => `
    <span class="tag">${l}<span class="tag-remove" onclick="removeLocation('${l}')">×</span></span>
`
    )
    .join("");

  // Dropdowns
  const mainFilter = document.getElementById("filter-loc");
  const modalSelect = document.getElementById("in-loc");
  const opts =
    '<option value="">場所を選択...</option>' +
    locations.map((l) => `<option value="${l}">${l}</option>`).join("");
  mainFilter.innerHTML =
    '<option value="">全ての場所</option>' +
    locations.map((l) => `<option value="${l}">${l}</option>`).join("");
  modalSelect.innerHTML = opts;
}

function addLocation() {
  const input = document.getElementById("new-loc-input");
  const val = input.value.trim();
  if (val && !locations.includes(val)) {
    locations.push(val);
    localStorage.setItem("stockly_locs", JSON.stringify(locations));
    input.value = "";
    renderLocations();
  }
}

function removeLocation(l) {
  if (confirm(`「${l}」をリストから削除しますか？`)) {
    locations = locations.filter((x) => x !== l);
    localStorage.setItem("stockly_locs", JSON.stringify(locations));
    renderLocations();
  }
}

// --- Inventory Management ---
function renderItems() {
  const list = document.getElementById("item-list");
  const search = document.getElementById("main-search").value.toLowerCase();
  const locFilter = document.getElementById("filter-loc").value;
  list.innerHTML = "";

  let oos = 0,
    exp = 0;
  const now = new Date();

  items
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search) &&
        (!locFilter || i.location === locFilter)
    )
    .forEach((item) => {
      if (item.quantity <= item.threshold) oos++;
      const diff = item.expiry
        ? Math.ceil((new Date(item.expiry) - now) / 86400000)
        : null;
      if (diff !== null && diff <= 7) exp++;

      const isPct = item.unit === "%";
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
            <div class="item-info">
                <div class="item-meta">
                    <span class="badge">${item.location}</span>
                    <span>⏳ ${item.expiry || "期限なし"}</span>
                </div>
                <h3>${item.name}</h3>
                ${
                  isPct
                    ? `<div class="progress-container"><div class="progress-bar" style="width:${
                        item.quantity
                      }%; background:${
                        item.quantity <= item.threshold
                          ? "var(--accent-color)"
                          : "var(--primary-color)"
                      }"></div></div>`
                    : ""
                }
                <div style="font-size:0.75rem; opacity:0.6;">${
                  item.memo || ""
                }</div>
            </div>
            <div class="stock-control">
                <button class="btn-qty" onclick="updateQty('${item.id}', ${
        isPct ? 10 : 1
      })">+</button>
                <div style="font-weight:bold;">${
                  item.quantity
                }<span style="font-size:0.7rem">${item.unit}</span></div>
                <button class="btn-qty" onclick="updateQty('${item.id}', ${
        isPct ? -10 : -1
      })">-</button>
                <div style="margin-top:10px; display:flex; gap:12px; opacity:0.3;">
                    <i data-lucide="edit-3" size="15" style="cursor:pointer" onclick="openEditModal('${
                      item.id
                    }')"></i>
                    <i data-lucide="trash-2" size="15" style="color:#ef4444; cursor:pointer" onclick="deleteItem('${
                      item.id
                    }')"></i>
                </div>
            </div>
        `;
      list.appendChild(card);
    });
  document.getElementById("count-out").innerText = oos;
  document.getElementById("count-exp").innerText = exp;
  lucide.createIcons();
}

function updateQty(id, delta) {
  const i = items.find((x) => x.id === id);
  if (i) {
    i.quantity = Math.max(0, i.quantity + delta);
    if (i.unit === "%") i.quantity = Math.min(100, i.quantity);
    save();
  }
}

function saveItem() {
  const name = document.getElementById("in-name").value;
  if (!name) return;
  const data = {
    id: editingId || Date.now().toString(),
    name,
    location: document.getElementById("in-loc").value || "未指定",
    quantity: parseInt(document.getElementById("in-qty").value),
    unit: document.getElementById("in-unit").value,
    threshold: parseInt(document.getElementById("in-threshold").value),
    expiry: document.getElementById("in-expiry").value,
    barcode: document.getElementById("in-barcode").value,
    memo: document.getElementById("in-memo").value,
  };
  if (editingId) items[items.findIndex((x) => x.id === editingId)] = data;
  else items.push(data);
  save();
  closeModal();
}

function deleteItem(id) {
  if (confirm("アイテムを削除しますか？")) {
    items = items.filter((x) => x.id !== id);
    save();
  }
}
function save() {
  localStorage.setItem("stockly_items", JSON.stringify(items));
  renderItems();
}
function resetAll() {
  if (confirm("全データを削除します。元には戻せません。")) {
    localStorage.clear();
    location.reload();
  }
}

// --- Modal & Scanner ---
function openAddModal() {
  editingId = null;
  resetForm();
  document.getElementById("modal-title").innerText = "アイテムの新規登録";
  document.getElementById("item-modal").style.display = "flex";
}
function openEditModal(id) {
  const i = items.find((x) => x.id === id);
  editingId = id;
  document.getElementById("modal-title").innerText = "アイテムの編集";
  document.getElementById("in-name").value = i.name;
  document.getElementById("in-loc").value = i.location;
  document.getElementById("in-qty").value = i.quantity;
  document.getElementById("in-unit").value = i.unit;
  document.getElementById("in-threshold").value = i.threshold;
  document.getElementById("in-expiry").value = i.expiry;
  document.getElementById("in-barcode").value = i.barcode;
  document.getElementById("in-memo").value = i.memo;
  if (i.barcode) setupBarcodeLinks(i.barcode);
  document.getElementById("item-modal").style.display = "flex";
}
function closeModal() {
  document.getElementById("item-modal").style.display = "none";
  stopScanner();
}
function resetForm() {
  document.getElementById("in-name").value = "";
  document.getElementById("in-qty").value = 100;
  document.getElementById("in-unit").value = "%";
  document.getElementById("in-threshold").value = 20;
  document.getElementById("in-expiry").value = "";
  document.getElementById("in-barcode").value = "";
  document.getElementById("in-memo").value = "";
  document.getElementById("barcode-helper").style.display = "none";
}

// --- Improved Scanner Logic (Immediate Response) ---
function startScanner() {
  document.getElementById("form-area").style.display = "none";
  document.getElementById("scanner-area").style.display = "block";

  html5QrCode = new Html5Qrcode("reader", { 
      formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8 ] 
  });
  const config = { fps: 20, qrbox: { width: 280, height: 160 } };

  html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
    // 即座に読み取りを確定させる
    document.getElementById("in-barcode").value = decodedText;
    setupBarcodeLinks(decodedText);
    if (navigator.vibrate) navigator.vibrate(150);
    stopScanner();

    // シンプルな名前検索試行 (外部制限のため成功時のみ反映)
    fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 1)
          document.getElementById("in-name").value = d.product.product_name;
      });
  })
  .then(() => {
      // Zoom capability check
      const zoomControl = document.getElementById("zoom-controls");
      const slider = document.getElementById("zoom-slider");
      
      try {
          // Some browsers/devices might not support this API
          const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
          
          if (capabilities && capabilities.zoom) {
              zoomControl.style.display = "block";
              slider.min = capabilities.zoom.min;
              slider.max = capabilities.zoom.max;
              slider.step = capabilities.zoom.step;
              slider.value = capabilities.zoom.value || (capabilities.zoom.min + 0); // Start at minimum (1x)
              
              slider.oninput = function() {
                  html5QrCode.applyVideoConstraints({
                      advanced: [{ zoom: parseFloat(this.value) }]
                  });
              };
          } else {
              zoomControl.style.display = "none";
          }
      } catch (err) {
          console.warn("Zoom capabilities not supported:", err);
          zoomControl.style.display = "none";
      }
  });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode
      .stop()
      .then(() => {
        html5QrCode = null;
        document.getElementById("form-area").style.display = "block";
        document.getElementById("scanner-area").style.display = "none";
      })
      .catch(() => {
        document.getElementById("form-area").style.display = "block";
        document.getElementById("scanner-area").style.display = "none";
      });
  }
}

function setupBarcodeLinks(code) {
  document.getElementById("barcode-helper").style.display = "block";
  document.getElementById(
    "link-yahoo"
  ).href = `https://shopping.yahoo.co.jp/search?p=${code}`;
  document.getElementById(
    "link-google"
  ).href = `https://www.google.com/search?q=JAN+${code}`;
}

window.onload = init;
