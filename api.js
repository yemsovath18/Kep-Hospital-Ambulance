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
  getFormOptions: 10 * 60 * 1000, // 10 នាទី — បញ្ជីរថយន្ត/អ្នកបើកបរ/មន្ត្រី/ទិសដៅ
  getReportData: 3 * 60 * 1000    // 3 នាទី — របាយការណ៍ប្រចាំខែ
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
      if (k.indexOf(CACHE_PREFIX + "getReportData_") === 0) {
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

  // សំណើថ្មីនេះនឹងផ្លាស់ប្តូរលេខសរុបក្នុងរបាយការណ៍ខែបច្ចុប្បន្ន —
  // លុប cache របាយការណ៍ទាំងអស់ចោល ដើម្បីកុំឲ្យបង្ហាញលេខហួសសម័យ
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
