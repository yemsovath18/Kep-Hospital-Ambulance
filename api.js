// ============================================================
// Kep Hospital Ambulance
// API Bridge: GitHub Pages → Google Apps Script
// ============================================================

const GAS_API_URL =
  "PASTE_YOUR_GOOGLE_APPS_SCRIPT_EXEC_URL_HERE";


// ============================================================
// API Request
// ============================================================

async function apiRequest(action, data = {}) {

  const url = new URL(GAS_API_URL);

  url.searchParams.set("action", action);

  Object.keys(data).forEach(function (key) {

    if (
      data[key] !== undefined &&
      data[key] !== null
    ) {
      url.searchParams.set(key, data[key]);
    }

  });

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      "API Error: " +
      response.status +
      " " +
      response.statusText
    );
  }

  const result = await response.json();

  if (result && result.ok === false) {
    throw new Error(
      result.error || "API request failed"
    );
  }

  return result.data;
}


// ============================================================
// Get Vehicles / Drivers / Staff / Destinations
// ============================================================

async function getFormOptions() {
  return await apiRequest("getFormOptions");
}


// ============================================================
// Submit Ambulance Dispatch
// ============================================================

async function submitDispatch(data) {

  return await apiRequest(
    "submitDispatch",
    {
      vehicle: data.vehicle || "",
      destination: data.destination || "",
      officer1: data.officer1 || "",
      officer2: data.officer2 || "",
      officer3: data.officer3 || "",
      driver: data.driver || "",
      notes: data.notes || ""
    }
  );
}


// ============================================================
// Get Monthly Report
// Example: getReportData("2026-09")
// ============================================================

async function getReportData(monthYear) {

  return await apiRequest(
    "getReportData",
    {
      monthYear: monthYear
    }
  );
}