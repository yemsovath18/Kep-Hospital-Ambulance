// ============================================================
// Kep Hospital Ambulance
// API Bridge: GitHub Pages → Google Apps Script
// ============================================================

const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbxdG8M_KsH0J60Bq7qJ-wdcce6aqJzOTlznYuP3IMR8H8A73gFi0XtQdXtGFEZUwFjLYw/exec";

// ការ Cache ខាង browser (localStorage) ដើម្បីកុំឲ្យរង់ចាំ Apps Script ជារៀងរាល់ដង
// (Apps Script Web App តែងតែយឺតជាង google.script.run ព្រោះត្រូវឆ្លងកាត់ HTTP
// redirect ថ្មីរាល់ពេល ហើយពេលខ្លះក៏មាន "cold start" ផងដែរ)។
const CACHE_TTL_MS = {
  getFormOptions: 10 * 60 * 1000,  // 10 នាទី — បញ្ជីរថយន្ត/អ្នកបើកបរ/មន្ត្រី/ទិសដៅ
  getReportData: 3 * 60 * 1000,    // 3 នាទី — របាយការណ៍ប្រចាំខែ
  getDashboardData: 5 * 60 * 1000  // 5 នាទី — ផ្ទាំងគ្រប់គ្រង (all-time)
};
const CACHE_PREFIX = "kepHospitalCache_";

function cacheKey_(action, data) {
  return CACHE_PREFIX + action + "_" + JSON.stringify(data || {});
}

function readCache_(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== "number") return null;
    if (Date.now() - parsed.t > ttlMs) return null;
    return parsed.v;
  } catch (e) {
    // localStorage មិនអាចប្រើបាន (private browsing, ឬបិទ) — រំលង cache
    return null;
  }
}

function writeCache_(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch (e) {
    // ធុងផ្ទុកពេញ ឬ localStorage មិនអាចប្រើបាន — មិនអីទេ គ្រាន់តែមិន cache
  }
}

function clearReportCache_() {
  try {
    Object.keys(localStorage).forEach(function (k) {
      if (
        k.indexOf(CACHE_PREFIX + "getReportData_") === 0 ||
        k.indexOf(CACHE_PREFIX + "getDashboardData_") === 0
      ) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    // ignore
  }
}

async function apiRequest(action, data = {}) {
  const url = new URL(GAS_API_URL);
  url.searchParams.set("action", action);
  Object.keys(data).forEach(function (key) {
    if (data[key] !== undefined && data[key] !== null) {
      url.searchParams.set(key, data[key]);
    }
  });
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("API Error: " + response.status + " " + response.statusText);
  }
  const result = await response.json();
  if (result && result.ok === false) {
    throw new Error(result.error || "API request failed");
  }
  return result.data;
}

async function getFormOptions() {
  const key = cacheKey_("getFormOptions", {});
  const cached = readCache_(key, CACHE_TTL_MS.getFormOptions);
  if (cached) return cached;

  const data = await apiRequest("getFormOptions");
  writeCache_(key, data);
  return data;
}

async function submitDispatch(data) {
  const result = await apiRequest("submitDispatch", {
    vehicle: data.vehicle || "",
    destination: data.destination || "",
    officer1: data.officer1 || "",
    officer2: data.officer2 || "",
    officer3: data.officer3 || "",
    driver: data.driver || "",
    notes: data.notes || ""
  });

  // សំណើថ្មីនេះនឹងផ្លាស់ប្តូរលេខសរុបក្នុងរបាយការណ៍ខែបច្ចុប្បន្ន និង dashboard —
  // លុប cache ទាំងអស់ចោល ដើម្បីកុំឲ្យបង្ហាញលេខហួសសម័យ
  clearReportCache_();

  return result;
}

async function getReportData(monthYear) {
  const key = cacheKey_("getReportData", { monthYear: monthYear });
  const cached = readCache_(key, CACHE_TTL_MS.getReportData);
  if (cached) return cached;

  const data = await apiRequest("getReportData", { monthYear: monthYear });
  writeCache_(key, data);
  return data;
}

async function getDashboardData() {
  const key = cacheKey_("getDashboardData", {});
  const cached = readCache_(key, CACHE_TTL_MS.getDashboardData);
  if (cached) return cached;

  const data = await apiRequest("getDashboardData");
  writeCache_(key, data);
  return data;
}

// ============================================================
// Admin — បន្ថែមរថយន្ត / អ្នកបើកបរ / មន្ត្រី / ទិសដៅ (មិន cache)
// ============================================================

function clearFormOptionsCache_() {
  try {
    localStorage.removeItem(cacheKey_("getFormOptions", {}));
  } catch (e) {
    // ignore
  }
}

async function adminGetOptions(password) {
  return apiRequest("adminGetOptions", { password: password });
}

async function adminAddItem(password, category, name, phone) {
  const data = await apiRequest("adminAddItem", {
    password: password,
    category: category,
    name: name,
    phone: phone || ""
  });
  // ធាតុថ្មីត្រូវបង្ហាញក្នុងទម្រង់ស្នើសុំភ្លាមៗ
  clearFormOptionsCache_();
  return data;
}

async function adminUpdateItem(password, category, oldName, name, phone) {
  const data = await apiRequest("adminUpdateItem", {
    password: password,
    category: category,
    oldName: oldName,
    name: name,
    phone: phone || ""
  });
  clearFormOptionsCache_();
  clearReportCache_();
  return data;
}

async function adminDeleteItem(password, category, name) {
  const data = await apiRequest("adminDeleteItem", {
    password: password,
    category: category,
    name: name
  });
  clearFormOptionsCache_();
  clearReportCache_();
  return data;
}

// ផ្ញើរបាយការណ៍ប្រចាំខែ (PDF) ទៅ Telegram — ប្រើ POST ព្រោះ PDF ធំពេកសម្រាប់ URL
async function adminSendReportPdf(password, monthYear, pdfBase64, caption) {
  const response = await fetch(GAS_API_URL, {
    method: "POST",
    // text/plain ដើម្បីជៀស CORS preflight (Apps Script មិនឆ្លើយ OPTIONS)
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "adminSendReportPdf",
      password: password,
      monthYear: monthYear,
      pdfBase64: pdfBase64,
      caption: caption || ""
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("API Error: " + response.status + " " + response.statusText);
  }
  const result = await response.json();
  if (result && result.ok === false) {
    throw new Error(result.error || "API request failed");
  }
  return result.data;
}

// ប្តូរពាក្យសម្ងាត់ Admin — ប្រើ POST ដើម្បីកុំឲ្យពាក្យសម្ងាត់ទៅដាក់ក្នុង URL
async function adminChangePassword(password, newPassword) {
  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "adminChangePassword",
      password: password,
      newPassword: newPassword
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("API Error: " + response.status + " " + response.statusText);
  }
  const result = await response.json();
  if (result && result.ok === false) {
    throw new Error(result.error || "API request failed");
  }
  return result.data;
}
