import Papa from "papaparse";

export function parseCsvText(csvText) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    });
  });
}

export function normalizeString(value) {
  return typeof value === "string" ? value.trim() : value || "";
}


