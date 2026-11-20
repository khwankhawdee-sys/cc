/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้า + ปุ่มกรอง mood
   - order.html   : เติมฟอร์มจาก URL + ส่งคำสั่งซื้อ
   - admin.html   : แสดงรายการสั่งซื้อจาก Google Sheet (CSV)
   ========================================================== */

(function () {
  "use strict";

  /* ---------- ค่าคงที่ ---------- */
  var APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbw7RlEjL1yKzqm3IhdjnkHvjguXuk1f4fTVX2yWeBlIwiq9iWWVM1pBMaAI3EqGV3GX1w/exec";

  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRllQfOvZHolRt8fgUietrwlVz85P_DO6dnbIZz4_oXPCBmOjJbeINUz6yVhd3wQs75Wis0X27HPfBb/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABEL = { spray: "สเปรย์ฉีดตัว", rollon: "โรลออน" };

  /* ---------- Helper ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  function formatPrice(price) {
    return Number(price).toLocaleString("th-TH") + " บาท";
  }

  /* ==========================================================
     1) product.html
     ========================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var activeMood = "all";

    function buildFilterBar() {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = el("button", "filter__btn", m.label);
        btn.type = "button";
        btn.dataset.mood = m.key;
        btn.addEventListener("click", function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    function updateActiveButton() {
      var buttons = filterBar.querySelectorAll(".filter__btn");
      for (var i = 0; i < buttons.length; i++) {
        var isActive = buttons[i].dataset.mood === activeMood;
        buttons[i].classList.toggle("is-active", isActive);
        buttons[i].setAttribute("aria-pressed", isActive ? "true" : "false");
      }
    }

    function buildCard(p) {
      var itemName = p.size ? p.name + " " + p.size : p.name;
      var orderUrl =
        "order.html?item=" + encodeURIComponent(itemName) +
        "&price=" + encodeURIComponent(p.price);

      var card = el("article", "product-card");
      card.dataset.mood = p.mood;

      var imageWrap = el("div", "product-card__image");
      var img = el("img");
      img.src = p.image;
      img.alt = itemName;
      img.loading = "lazy";
      imageWrap.appendChild(img);

      var body = el("div", "product-card__body");

      var meta = el("div", "product-card__meta");
      meta.appendChild(el("span", "mood-dot"));
      meta.appendChild(document.createTextNode(moodLabel(p.mood)));

      var title = el("h3", "product-card__title", p.name);

      // บรรทัดไซส์ (ใช้ class desc เพื่อดันส่วนท้ายการ์ดให้เรียงเสมอกัน)
      var sizeText = p.size ? "ขนาด " + p.size : TYPE_LABEL[p.type] || "";
      var size = el("p", "product-card__desc", sizeText);

      var footer = el("div", "product-card__footer");
      footer.appendChild(el("span", "price", formatPrice(p.price)));
      var buy = el("a", "btn btn--accent", "สั่งซื้อ");
      buy.href = orderUrl;
      footer.appendChild(buy);

      body.appendChild(meta);
      body.appendChild(title);
      body.appendChild(size);
      body.appendChild(footer);

      card.appendChild(imageWrap);
      card.appendChild(body);
      return card;
    }

    function render() {
      list.textContent = "";
      var shown = products.filter(function (p) {
        return activeMood === "all" || p.mood === activeMood;
      });
      if (shown.length === 0) {
        list.appendChild(el("p", "text-center", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function setMood(key) {
      activeMood = key;
      updateActiveButton();
      render();
    }

    buildFilterBar();

    // อ่าน ?mood=xxx (ใช้ได้เฉพาะค่าที่มีในรายการ)
    var moodParam = new URLSearchParams(window.location.search).get("mood");
    if (moodParam) {
      moodParam = moodParam.toLowerCase();
      if (MOODS.some(function (m) { return m.key === moodParam; })) {
        activeMood = moodParam;
      }
    }
    updateActiveButton();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = "";
        list.appendChild(el("p", "text-center", "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
      });
  }

  /* ==========================================================
     2) order.html
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // เติมสินค้าและราคาจาก URL ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (itemsInput && item !== null) itemsInput.value = item;
    if (totalInput && price !== null) totalInput.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var payload = {
        customerName: document.getElementById("customerName").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        items: document.getElementById("items").value.trim(),
        total: document.getElementById("total").value.trim(),
        note: document.getElementById("note").value.trim()
      };

      fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = "thankyou.html";
        })
        .catch(function (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) admin.html
     ========================================================== */

  // parse CSV เอง: รองรับเครื่องหมาย " ครอบข้อความ, "" แทน ", เครื่องหมายจุลภาคและขึ้นบรรทัดใหม่ในช่อง
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }

    // แถวสุดท้ายที่ไม่มีการขึ้นบรรทัดใหม่ปิดท้าย
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (c) { return c.trim() !== ""; });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLUMNS = 6;

    function showMessage(message) {
      tbody.textContent = "";
      var tr = el("tr");
      var td = el("td", null, message);
      td.colSpan = COLUMNS;
      td.style.textAlign = "center";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(SHEET_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // ถ้าแถวแรกเป็นหัวตาราง (คอลัมน์ A ไม่มีตัวเลขเลย ต่างจากวันเวลา) ให้ข้าม
        if (rows.length > 0 && !/\d/.test(rows[0][0] || "")) {
          rows.shift();
        }

        if (rows.length === 0) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // Sheet เพิ่มแถวใหม่ต่อท้ายเสมอ จึงกลับลำดับให้รายการล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.textContent = "";
        rows.forEach(function (r) {
          var tr = el("tr");
          for (var c = 0; c < COLUMNS; c++) {
            tr.appendChild(el("td", null, r[c] !== undefined ? r[c] : ""));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- เริ่มทำงาน (เลือกตามหน้าที่มี element นั้นๆ) ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
