import Papa from "papaparse";

const sendSchema = [
  { canonical: "recipient_name", aliases: ["recipient_name", "Recipient Name"] },
  { canonical: "sent_date", aliases: ["sent_date", "Date", "Sent"] },
  {
    canonical: "Recipient Email",
    aliases: ["Recipient Email", "recipient_email", "RecipientEmail"],
  },
];

const openSchema = [
  { canonical: "recipient_name", aliases: ["recipient_name", "Recipient"] },
  { canonical: "sent_date", aliases: ["sent_date", "Sent", "Date"] },
  { canonical: "Views", aliases: ["Views", "Opens"] },
  { canonical: "Clicks", aliases: ["Clicks"] },
];

const contactSchema = [
  { canonical: "Email", aliases: ["Email", "email", "Recipient Email"] },
];

const callsSchema = [
  { canonical: "Assigned", aliases: ["Assigned", "Owner"] },
  { canonical: "Call Disposition", aliases: ["Call Disposition", "Disposition"] },
  { canonical: "Date", aliases: ["Date", "Call Date"] },
  {
    canonical: "Company / Account",
    aliases: ["Company / Account", "Company", "Account"],
  },
  { canonical: "Contact", aliases: ["Contact", "Recipient Name"] },
  {
    canonical: "Call Duration",
    aliases: ["Call Duration", "Duration", "Call Duration (seconds)"],
  },
];

export function extractHeaders(csvText) {
  let headers = [];

  Papa.parse(csvText, {
    header: true,
    delimiter: ",",
    skipEmptyLines: true,
    preview: 1,
    complete: (res) => {
      headers = res.meta.fields || [];
    },
  });

  return headers;
}

function ensureHeaders(headers, schema, label) {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));

  const missing = schema.filter((req) =>
    !req.aliases.some((alias) => normalizedHeaders.has(normalizeHeader(alias)))
  );

  if (missing.length) {
    throw new Error(
      `${label}: missing required columns → ${missing
        .map((m) => m.canonical)
        .join(", ")}`
    );
  }
}

export function validateSendHeaders(csvText) {
  const headers = extractHeaders(csvText);
  ensureHeaders(headers, sendSchema, "Send CSV");
}

export function validateOpenHeaders(csvText) {
  const headers = extractHeaders(csvText);
  ensureHeaders(headers, openSchema, "Open CSV");
}

export function validateContactsHeaders(csvText) {
  const headers = extractHeaders(csvText);
  ensureHeaders(headers, contactSchema, "Contacts CSV");
}

export function validateCallsHeaders(csvText) {
  const headers = extractHeaders(csvText);
  ensureHeaders(headers, callsSchema, "Calls CSV");
}

function normalizeHeader(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}


