# EMS HRMS (Human Resource Management System)

## Overview & Value Proposition
The EMS HRMS is a comprehensive, client-side web application designed to streamline the management of Emergency Medical Services (EMS) personnel in Grand RP. Built with a focus on speed, privacy, and efficiency, it automates the tedious processes of logging shift hours, calculating payouts, and managing employee rosters.

**For Investors & Open Source Contributors:** This application proves that complex business logic, parsing engines, and real-time data calculations can be seamlessly executed without a heavy backend infrastructure. By utilizing an optimized Firestore architecture combined with client-side AES encryption (CryptoJS), the application ensures robust data security, scalability, and minimal server overhead.

---

## 1. System Architecture & Database Layout

The HRMS operates with a "smart client, dumb server" architecture. The core logic executes entirely within the browser (`index.html`, `style.css`, `script.js`), leveraging Firebase Cloud Firestore as a scalable data store.

### Firestore Collections Restructuring for Scale
To bypass Firestore's 1MB document limit and ensure infinite scalability, the database is split into three core collections:
1.  **`app_state` (Document: `master_state`)**: Stores the lightweight core configuration, including application settings, the employee roster, and manual High Command (HC) bonuses.
2.  **`discord_logs`**: A scalable collection dedicated to storing ingested logs. Logs are batched and chunked by week (e.g., `logs_week_32_2026`). 
3.  **`flagged_logs` (Document: `pending`)**: An isolated collection storing malformed or incomplete logs that require manual review by administrators.

### Security & Privacy
*   **End-to-End Encryption**: Before data is transmitted to Firestore, it is encrypted locally using `CryptoJS.AES`. The backend only stores encrypted ciphertext, ensuring that sensitive employee data, payouts, and activity logs remain private and unreadable directly from the Firebase console.

---

## 2. The Ingestion Engine & Log Parsing

A key feature of the HRMS is its intelligent log parsing engine (`ingestLogs()`), which takes raw text pasted from Discord and converts it into structured data.

**Expected Format:**
```
Rank | Name | ID — Time Stamp
On Duty [Location]: [HH:MM]
Off Duty [Location]: [HH:MM]
```

**Parsing Rules:**
*   **Identity Split:** Splits the left side of the dash (`—` or `--`) by the pipe character `|` to extract Rank, Name, and ID.
*   **Time Zone Conversion:** Logs timestamped in **IST** (Indian Standard Time) are automatically converted to **BST** (Edinburgh Time) by subtracting 4 hours and 30 minutes, ensuring accurate shift night/day validation.
*   **Fuzzy Location Matching:** The application uses fuzzy matching to detect the duty location (`PH front`, `PH back`, `SH`, `Labs`, `Calls`) from the "On Duty" string. If the parsing engine lacks confidence, the log is pushed to the `flagged_logs` collection for human review, preventing bad data from corrupting calculations.

---

## 3. Shift and Time Calculations

### Duration & Buffer
*   **Calculation:** `Off-Duty Time - On-Duty Time`
*   **Midnight Crossing:** The engine detects shifts crossing midnight using both the numerical time values and the message Time Stamp (IST).
*   **Buffer Time:** A global "Buffer" variable pads shifts to ensure fair compensation, but final durations are capped dynamically as per operational rules.

### Night Shift Detection
*   A shift is flagged as a **Night Shift** if the converted **BST On-Duty Time** falls between `00:00` (12:00 AM) and `06:00` (6:00 AM), which unlocks premium bonus tiers.

---

## 4. Bonus and Payout Algorithms

The recalculation engine (`recalculateEverything()`) continuously updates payouts as new logs are ingested.

**1. Base Wage:**
*   **$1,300 per hour** of total calculated duty time.

**2. Shift Category Bonuses (Per Hour):**
The hourly rate is multiplied by the duration of the shift based on category and time of day:
*   **PH (Front):** Day: $10,000/hr | Night: $25,000/hr
*   **SH (Sandy Shores):** Day: $30,000/hr | Night: $40,000/hr
*   **Calls:** Day: $15,000/hr | Night: $20,000/hr

**3. Flat Log Bonuses (Lab / FTO):**
*   **Labs:** Flat $5,000 bonus per log (using Captcha rate).
*   **FTO:** Flat $45,000 bonus per log (using Day 1 rate).

**4. Tier Bonuses:**
A weekly bonus given based on the total hours worked:
*   **Under 20 Hours:** $10,000
*   **20 to 34.9 Hours:** $15,000
*   **35+ Hours:** $25,000

**5. Employee Multiplier:**
Each employee in the Roster has an experience/rank multiplier (default `1.0`).
```javascript
Total Payout = (Base Wage + Shift Bonuses + Lab/FTO Bonuses + Tier Bonus) * Employee Multiplier
```

This dynamic HRMS serves as a robust framework that brings order, analytics, and precise financial calculation to complex organizational structures.
