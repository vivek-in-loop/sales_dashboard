import { parseCsvText } from "./csvUtils";

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toSeconds(value) {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function normalizeKey(value) {
  return value ? String(value).trim().toLowerCase() : "";
}

export async function processCallsCsv(csvText) {
  const rows = await parseCsvText(csvText);
  const stats = computeStats(rows);
  return { rows, stats };
}

function computeStats(rows) {
  const totalCalls = rows.length;

  const companySet = new Set();
  const contactSet = new Set();
  const dispositionCounts = new Map();
  const daySet = new Set();

  let connected = 0;
  let totalDuration = 0;

  rows.forEach((row) => {
    const companyKey = normalizeKey(row["Company / Account"] || row.Company);
    if (companyKey) companySet.add(companyKey);

    const contactKey = normalizeKey(row.Contact);
    if (contactKey) contactSet.add(contactKey);

    const disposition = row["Call Disposition"] || "Unknown";
    const dispKey = disposition.trim() || "Unknown";
    dispositionCounts.set(dispKey, (dispositionCounts.get(dispKey) || 0) + 1);

    if (dispKey.toLowerCase().includes("connect")) connected += 1;

    totalDuration += toSeconds(row["Call Duration"]);

    const d = toDate(row.Date);
    if (d) daySet.add(d.toDateString());
  });

  const topDisposition = [...dispositionCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];

  const durationHours = totalDuration / 3600;
  const connectRate = totalCalls ? (connected / totalCalls) * 100 : 0;
  const dispositionTypes = dispositionCounts.size;
  const dailyAvg = daySet.size ? totalCalls / daySet.size : totalCalls;

  return {
    totalCalls,
    uniqueCompanies: companySet.size,
    connectRate,
    durationHours,
    uniqueContacts: contactSet.size,
    topDisposition: topDisposition || "N/A",
    dispositionTypes,
    dailyAvg,
  };
}

export function filterCalls(rows, filters) {
  const { assigned, disposition, company } = filters;
  const assignedLower = assigned.toLowerCase();
  const dispositionLower = disposition.toLowerCase();
  const companyLower = company.toLowerCase();

  return rows.filter((row) => {
    const matchesAssigned = assignedLower
      ? (row.Assigned || "").toLowerCase().includes(assignedLower)
      : true;
    const matchesDisposition = dispositionLower
      ? (row["Call Disposition"] || "")
          .toLowerCase()
          .includes(dispositionLower)
      : true;
    const matchesCompany = companyLower
      ? (
          row["Company / Account"] ||
          row.Company ||
          row.Account ||
          ""
        ).toLowerCase().includes(companyLower)
      : true;
    return matchesAssigned && matchesDisposition && matchesCompany;
  });
}

export function callsPerDay(rows) {
  const counts = rows.reduce((acc, row) => {
    const d = toDate(row.Date);
    if (!d) return acc;
    const key = d.toISOString().split("T")[0];
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());

  const sorted = [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return {
    labels: sorted.map((entry) => entry[0]),
    values: sorted.map((entry) => entry[1]),
  };
}


