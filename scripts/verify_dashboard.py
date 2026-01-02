"""
Standalone verifier for dashboard metrics.

Usage:
  python scripts/verify_dashboard.py \
    --sends "data/uploads/Outbound Sheet - Sales - Report - Raw Data - Harshit (6).csv" \
    --opens "data/uploads/mailsuite_opened_1764775178 (2).csv" \
    --contacts "data/uploads/contacts.csv" \
    --mode email_only|timestamp|hybrid

What it does:
1) Load Send, Open, and Contacts CSVs.
2) Normalize columns and parse dates.
3) Filter out loopwork.co sends (same as dashboard).
4) Extract emails from Opens (regex, handles multi-recipient strings).
5) Match sends to opens using selectable modes:
     - email_only  (current JS default)
     - timestamp   (Python incremental 0–60s)
     - hybrid      (timestamp, then email fallback)
6) Compute key KPIs to compare with the dashboard.
7) Print data-quality diagnostics (missing emails in Opens, contact gaps).
"""

import argparse
import re
from pathlib import Path

import pandas as pd


EMAIL_REGEX = re.compile(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")


def parse_args():
    p = argparse.ArgumentParser(description="Verify dashboard metrics")
    p.add_argument("--sends", required=True, help="Path to Send CSV")
    p.add_argument("--opens", required=True, help="Path to Opens CSV")
    p.add_argument("--contacts", required=True, help="Path to Contacts CSV")
    p.add_argument(
        "--mode",
        choices=[
            "email_only",
            "timestamp",
            "hybrid",
            "relaxed",
            "dataprocessor",
            "name_timestamp",
            "composite",
        ],
        default="email_only",
        help=(
            "Matching mode: "
            "email_only (default), "
            "timestamp (0-60s), "
            "hybrid (timestamp then email), "
            "relaxed (timestamp 0-60s, then 5m closest, then email fallback), "
            "dataprocessor (alias of timestamp to mirror Python DataProcessor), "
            "name_timestamp (timestamp 0-60s using recipient_name instead of email), "
            "composite (email then name+subject then subject then name, about 85 percent coverage)"
        ),
    )
    return p.parse_args()


def load_sends(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    # Normalize columns
    df = df.rename(
        columns={
            "Date": "sent_date",
            "Recipient Name": "recipient_name",
            "Recipient Email": "recipient_email",
            "Domain": "domain",
            "Subject": "Subject",  # Keep as Subject for matching
            "Thread ID": "thread_id",
            "message_id": "message_id",
        }
    )
    # Parse dates (day-first)
    df["sent_date"] = pd.to_datetime(df["sent_date"], dayfirst=True, errors="coerce")
    # Normalized recipient name for name-based matching (lower, trimmed, first part before comma)
    # Also remove email addresses, angle brackets, and quotes
    def normalize_name(val):
        if pd.isna(val):
            return ""
        val = str(val).strip()
        # Remove email addresses
        val = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "", val)
        # Remove <...> angle brackets and content
        val = re.sub(r"<[^>]*>", "", val)
        # Take first part before comma
        val = val.split(",")[0].strip()
        # Remove quotes
        val = val.replace('"', "").strip()
        # Remove N/A patterns
        val = re.sub(r"n/a", "", val, flags=re.IGNORECASE)
        return val.lower().strip()

    df["recipient_name_norm"] = df["recipient_name"].apply(normalize_name)
    # Filter out loopwork.co (same as dashboard)
    if "domain" in df.columns:
        df = df[~df["domain"].str.lower().str.contains("loopwork.co", na=False)]
    return df


def extract_emails_from_recipient(val: str):
    if pd.isna(val):
        return []
    return [m.group(1).lower() for m in EMAIL_REGEX.finditer(str(val))]


def load_opens(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    # Normalize column names - keep Subject as-is for matching
    df = df.rename(
        columns={
            "Recipient": "recipient_raw",
            "Sent": "sent_date",
            "Opens": "Views",
            "Clicks": "Clicks",
            "Last Opened": "last_opened",
        }
    )
    # Extract ALL emails from recipient_raw
    df["emails_extracted"] = df["recipient_raw"].apply(extract_emails_from_recipient)
    # Primary email for timestamp matching (first extracted)
    df["primary_email"] = df["emails_extracted"].apply(lambda lst: lst[0] if lst else None)
    # Normalized recipient name for name-based matching (lower, trimmed, first part before comma)
    # Also remove email addresses, angle brackets, and quotes
    def normalize_name(val):
        if pd.isna(val):
            return ""
        val = str(val).strip()
        # Remove email addresses
        val = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "", val)
        # Remove <...> angle brackets and content
        val = re.sub(r"<[^>]*>", "", val)
        # Take first part before comma
        val = val.split(",")[0].strip()
        # Remove quotes
        val = val.replace('"', "").strip()
        return val.lower().strip()

    df["recipient_name_norm"] = df["recipient_raw"].apply(normalize_name)
    # Parse dates
    df["sent_date"] = pd.to_datetime(df["sent_date"], errors="coerce")
    return df


def load_contacts(path: Path) -> pd.DataFrame:
    # Try common encodings to avoid UnicodeDecodeError
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    last_err = None
    for enc in encodings:
        try:
            df = pd.read_csv(path, encoding=enc)
            break
        except Exception as e:  # keep going on decode failures
            last_err = e
            df = None
    if df is None:
        raise last_err

    # Expect an Email column; normalize name just in case
    if "Email" not in df.columns and "email" in df.columns:
        df = df.rename(columns={"email": "Email"})
    df["Email"] = df["Email"].str.lower().str.strip()
    return df


def match_send_open_email_only(sends: pd.DataFrame, opens: pd.DataFrame):
    # Build opens lookup by email → most recent open record
    open_lookup = {}
    for _, row in opens.iterrows():
        emails = row["emails_extracted"]
        if not emails:
            continue
        for email in emails:
            # Keep the most recent open per email
            existing = open_lookup.get(email)
            if existing is None or (
                pd.notna(row["sent_date"])
                and pd.notna(existing["sent_date"])
                and row["sent_date"] > existing["sent_date"]
            ):
                open_lookup[email] = row

    matched = []
    for _, send in sends.iterrows():
        email = str(send.get("recipient_email", "")).lower().strip()
        open_row = open_lookup.get(email)
        if open_row is not None:
            matched.append({"send": send, "open": open_row})
    return matched


# ---------- Timestamp matching (Python-style 0–60s incremental) ----------

def _incremental_match(send_row, email_opens, used_indices, start, end):
    """
    Try to match a send record to opens for the same email between offsets [start, end] seconds.
    Returns (matched_open, matched_index) or (None, None).
    """
    base_dt = send_row["sent_date"]
    if pd.isna(base_dt):
        return None, None

    for inc in range(start, end + 1):
        search_dt = base_dt + pd.Timedelta(seconds=inc)
        matches = email_opens[email_opens["sent_date"] == search_dt]
        matches = matches[~matches.index.isin(used_indices)]
        if len(matches) == 1:
            idx = matches.index[0]
            return matches.iloc[0], idx
        # If multiple, treat as no unique match per original logic
    return None, None


def match_send_open_timestamp(sends: pd.DataFrame, opens: pd.DataFrame):
    """
    Implements the two-phase incremental datetime matching:
      Phase1: +0..11 seconds
      Phase2: +12..60 seconds (on unmatched, using unused opens)
    Joins by email AND timestamp.
    """
    # Build lookup: primary_email -> opens subset
    opens_by_email = {
        email: opens[opens["primary_email"] == email] for email in opens["primary_email"].dropna().unique()
    }
    used_indices = set()
    matches = []

    # Phase 1
    unmatched = []
    for _, send in sends.iterrows():
        email = str(send.get("recipient_email", "")).lower().strip()
        if not email or email not in opens_by_email:
            unmatched.append(send)
            continue
        open_row, idx = _incremental_match(send, opens_by_email[email], used_indices, 0, 11)
        if open_row is not None:
            used_indices.add(idx)
            matches.append({"send": send, "open": open_row})
        else:
            unmatched.append(send)

    # Phase 2 on unmatched
    still_unmatched = []
    for send in unmatched:
        email = str(send.get("recipient_email", "")).lower().strip()
        if not email or email not in opens_by_email:
            still_unmatched.append(send)
            continue
        open_row, idx = _incremental_match(send, opens_by_email[email], used_indices, 12, 60)
        if open_row is not None:
            used_indices.add(idx)
            matches.append({"send": send, "open": open_row})
        else:
            still_unmatched.append(send)

    return matches, still_unmatched


def match_send_open_name_timestamp(sends: pd.DataFrame, opens: pd.DataFrame):
    """
    Timestamp matching using recipient_name (normalized) instead of email.
    Mirrors the 0-60s incremental approach:
      Phase1: +0..11 seconds
      Phase2: +12..60 seconds on unmatched (using unused opens)
    """
    opens_by_name = {
        name: opens[opens["recipient_name_norm"] == name]
        for name in opens["recipient_name_norm"].dropna().unique()
    }
    used_indices = set()
    matches = []

    # Phase 1
    unmatched = []
    for _, send in sends.iterrows():
        name = str(send.get("recipient_name_norm", "")).strip()
        if not name or name not in opens_by_name:
            unmatched.append(send)
            continue
        open_row, idx = _incremental_match(send, opens_by_name[name], used_indices, 0, 11)
        if open_row is not None:
            used_indices.add(idx)
            matches.append({"send": send, "open": open_row})
        else:
            unmatched.append(send)

    # Phase 2 on unmatched
    still_unmatched = []
    for send in unmatched:
        name = str(send.get("recipient_name_norm", "")).strip()
        if not name or name not in opens_by_name:
            still_unmatched.append(send)
            continue
        open_row, idx = _incremental_match(send, opens_by_name[name], used_indices, 12, 60)
        if open_row is not None:
            used_indices.add(idx)
            matches.append({"send": send, "open": open_row})
        else:
            still_unmatched.append(send)

    return matches, still_unmatched


# ---------- Relaxed matching: timestamp (0–60s), then ±5 minutes closest, then email fallback ----------

def _closest_within_window(send_row, email_opens, used_indices, window_seconds=300):
    """
    Find the closest open within +/- window_seconds, preferring opens AFTER send time.
    Returns (matched_open, matched_index) or (None, None).
    """
    base_dt = send_row["sent_date"]
    if pd.isna(base_dt):
        return None, None

    # Candidate set
    candidates = email_opens[~email_opens.index.isin(used_indices)].copy()
    if candidates.empty:
        return None, None

    # Keep only within window
    candidates["delta"] = (candidates["sent_date"] - base_dt).abs()
    candidates["dir"] = (candidates["sent_date"] - base_dt).apply(lambda x: 1 if x >= pd.Timedelta(0) else -1)
    in_window = candidates[candidates["delta"] <= pd.Timedelta(seconds=window_seconds)]
    if in_window.empty:
        return None, None

    # Prefer after-send records; if none, use closest overall
    after = in_window[in_window["dir"] >= 0]
    if not after.empty:
        chosen = after.sort_values(["delta", "sent_date"]).iloc[0]
    else:
        chosen = in_window.sort_values(["delta", "sent_date"]).iloc[0]
    idx = chosen.name
    return chosen, idx


def match_send_open_relaxed(sends: pd.DataFrame, opens: pd.DataFrame):
    """
    Relaxed strategy:
      Phase1: timestamp 0-11s
      Phase2: timestamp 12-60s
      Phase3: closest within +/-5 minutes (prefer after send)
      Phase4: email-only fallback (most recent)
    """
    # Reuse timestamp phases
    ts_matches, ts_unmatched = match_send_open_timestamp(sends, opens)

    # Build lookup for email
    opens_by_email = {
        email: opens[opens["primary_email"] == email] for email in opens["primary_email"].dropna().unique()
    }
    used_indices = {m["open"].name for m in ts_matches}
    relaxed_matches = []
    still_unmatched = []

    # Phase3: closest within +/-5 minutes
    for _, send in pd.DataFrame(ts_unmatched).iterrows():
        email = str(send.get("recipient_email", "")).lower().strip()
        if not email or email not in opens_by_email:
            still_unmatched.append(send)
            continue
        open_row, idx = _closest_within_window(send, opens_by_email[email], used_indices, window_seconds=300)
        if open_row is not None:
            used_indices.add(idx)
            relaxed_matches.append({"send": send, "open": open_row})
        else:
            still_unmatched.append(send)

    # Phase4: email-only fallback for remaining unmatched
    email_fallback = match_send_open_email_only(pd.DataFrame(still_unmatched), opens)

    matches = ts_matches + relaxed_matches + email_fallback
    return matches


def match_send_open_composite(sends: pd.DataFrame, opens: pd.DataFrame):
    """
    Composite multi-strategy matching for maximum coverage (~85%):
      Phase1: Email match (highest confidence)
      Phase2: Name + Subject match (medium confidence)
      Phase3: Subject-only match (lower confidence)
      Phase4: Name-only match (lowest confidence)
    """
    used_indices = set()
    all_matches = []
    match_methods = {}

    # Build lookups
    opens_by_email = {}
    for email in opens["primary_email"].dropna().unique():
        opens_by_email[email] = opens[opens["primary_email"] == email]

    opens_by_name_subject = {}
    for _, row in opens.iterrows():
        name = str(row.get("recipient_name_norm", "")).strip()
        subj = str(row.get("Subject", "")).lower().strip()
        if name and subj:
            key = f"{name}|||{subj}"
            if key not in opens_by_name_subject:
                opens_by_name_subject[key] = []
            opens_by_name_subject[key].append((row.name, row))

    opens_by_subject = {}
    for _, row in opens.iterrows():
        subj = str(row.get("Subject", "")).lower().strip()
        if subj:
            existing = opens_by_subject.get(subj)
            if existing is None or (
                pd.notna(row["sent_date"])
                and pd.notna(existing[1]["sent_date"])
                and row["sent_date"] > existing[1]["sent_date"]
            ):
                opens_by_subject[subj] = (row.name, row)

    opens_by_name = {}
    for _, row in opens.iterrows():
        name = str(row.get("recipient_name_norm", "")).strip()
        if name and len(name) > 2:
            existing = opens_by_name.get(name)
            if existing is None or (
                pd.notna(row["sent_date"])
                and pd.notna(existing[1]["sent_date"])
                and row["sent_date"] > existing[1]["sent_date"]
            ):
                opens_by_name[name] = (row.name, row)

    # Process each send
    unmatched_phase1 = []
    unmatched_phase2 = []
    unmatched_phase3 = []

    # Phase 1: Email match
    for _, send in sends.iterrows():
        email = str(send.get("recipient_email", "")).lower().strip()
        if email in opens_by_email:
            email_opens = opens_by_email[email]
            available = email_opens[~email_opens.index.isin(used_indices)]
            if not available.empty:
                # Take most recent
                best = available.sort_values("sent_date", ascending=False).iloc[0]
                used_indices.add(best.name)
                all_matches.append({"send": send, "open": best, "method": "email"})
                continue
        unmatched_phase1.append(send)

    # Phase 2: Name + Subject match
    for send in unmatched_phase1:
        name = str(send.get("recipient_name_norm", "")).strip()
        subj = str(send.get("Subject", "")).lower().strip()
        key = f"{name}|||{subj}"
        if key in opens_by_name_subject:
            candidates = [(idx, row) for idx, row in opens_by_name_subject[key] if idx not in used_indices]
            if candidates:
                # Take most recent
                candidates.sort(key=lambda x: x[1]["sent_date"] if pd.notna(x[1]["sent_date"]) else pd.Timestamp.min, reverse=True)
                idx, open_row = candidates[0]
                used_indices.add(idx)
                all_matches.append({"send": send, "open": open_row, "method": "name_subject"})
                continue
        unmatched_phase2.append(send)

    # Phase 3: Subject-only match
    for send in unmatched_phase2:
        subj = str(send.get("Subject", "")).lower().strip()
        if subj in opens_by_subject:
            idx, open_row = opens_by_subject[subj]
            if idx not in used_indices:
                used_indices.add(idx)
                all_matches.append({"send": send, "open": open_row, "method": "subject_only"})
                continue
        unmatched_phase3.append(send)

    # Phase 4: Name-only match
    for send in unmatched_phase3:
        name = str(send.get("recipient_name_norm", "")).strip()
        if name and len(name) > 2 and name in opens_by_name:
            idx, open_row = opens_by_name[name]
            if idx not in used_indices:
                used_indices.add(idx)
                all_matches.append({"send": send, "open": open_row, "method": "name_only"})

    return all_matches


def main():
    args = parse_args()
    sends = load_sends(Path(args.sends))
    opens = load_opens(Path(args.opens))
    contacts = load_contacts(Path(args.contacts))

    total_sends = len(sends)
    unique_prospects = sends["recipient_email"].str.lower().str.strip().nunique()

    # Email extraction coverage in opens
    opens_with_emails = opens[opens["emails_extracted"].str.len() > 0]
    opens_without_emails = len(opens) - len(opens_with_emails)

    # Match sends to opens according to mode
    # alias dataprocessor -> timestamp to mirror Python DataProcessor incremental join
    mode = "timestamp" if args.mode == "dataprocessor" else args.mode

    if mode == "email_only":
        matches = match_send_open_email_only(sends, opens)
    elif mode == "timestamp":
        matches, _ = match_send_open_timestamp(sends, opens)
    elif mode == "hybrid":
        ts_matches, ts_unmatched = match_send_open_timestamp(sends, opens)
        email_fallback = match_send_open_email_only(pd.DataFrame(ts_unmatched), opens)
        matches = ts_matches + email_fallback
    elif mode == "name_timestamp":
        matches, _ = match_send_open_name_timestamp(sends, opens)
    elif mode == "composite":
        matches = match_send_open_composite(sends, opens)
    else:  # relaxed
        matches = match_send_open_relaxed(sends, opens)

    matched_count = len(matches)

    # Open Rate = records with non-NULL Views / total sends
    # Here, matched sends are the ones with non-null Views (since Views comes from Open)
    open_rate = (matched_count / total_sends * 100) if total_sends else 0

    # Prospect opened %
    opened_prospect_emails = {
        str(m["send"]["recipient_email"]).lower().strip() for m in matches
    }
    opened_prospects = len(opened_prospect_emails)
    prospect_opened_pct = (
        opened_prospects / unique_prospects * 100 if unique_prospects else 0
    )

    # Contact match
    contact_emails = set(contacts["Email"].dropna().str.lower().str.strip())
    sends_with_contact = sum(
        1
        for _, row in sends.iterrows()
        if str(row["recipient_email"]).lower().strip() in contact_emails
    )
    contact_match_pct = (
        sends_with_contact / total_sends * 100 if total_sends else 0
    )

    print("=== DASHBOARD VERIFICATION REPORT ===")
    print(f"Sends total (filtered): {total_sends}")
    print(f"Unique prospects:       {unique_prospects}")
    print("")
    print("Opens CSV quality:")
    print(f"  Total Opens rows:           {len(opens)}")
    print(f"  Opens with emails:          {len(opens_with_emails)}")
    print(f"  Opens without emails:       {opens_without_emails}")
    print(f"  Email coverage in opens:    {(len(opens_with_emails) / len(opens) * 100):.1f}%")
    print("")
    print(f"Matching mode: {args.mode}")
    print(f"  Matched sends (Views!=NULL): {matched_count}")
    print(f"  Open Rate:                   {open_rate:.1f}%")
    print(f"  Opened prospects:            {opened_prospects}")
    print(f"  Prospect opened %:           {prospect_opened_pct:.1f}%")
    print("")
    print("Contacts matching (send -> contacts):")
    print(f"  Sends matched with contacts: {sends_with_contact}")
    print(f"  Contact match %:             {contact_match_pct:.1f}%")
    print("")
    print("Findings:")
    if opens_without_emails > 0:
        print(
            f"- {opens_without_emails} Opens rows lack emails "
            "(names only) → cannot be matched. "
            "This is the main reason Open Rate is capped."
        )
    if open_rate < 20:
        print(
            "- Open Rate is low because only opens with extractable emails can be matched. "
            "Re-export Opens with recipient emails to improve coverage, or switch to hybrid/timestamp mode."
        )
    print("=====================================")


if __name__ == "__main__":
    main()

