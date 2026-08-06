# EMS Employee Companion

## Overview & Value Proposition
The **EMS Employee Companion** is a lightweight, responsive web application designed as an essential toolkit for Emergency Medical Services (EMS) personnel in Grand RP. It provides an intuitive interface for employees to manage their shift procedures, bodycam logs, radio communications, and department-specific commands.

**For Investors & Open Source Contributors:** This tool demonstrates a practical, user-centric approach to solving operational friction in roleplay or simulation environments. By consolidating multiple disjointed processes (like tracking duty time, formatting Discord logs, and remembering complex radio codes) into a single, sleek UI, the application significantly reduces human error and onboarding time for new personnel.

---

## 1. Key Features

### Shift Timer & Duty Tracking
*   A persistent visual progress bar and timer track the total duration of the employee's current shift.
*   The timer seamlessly integrates with the user's local state to ensure it survives browser refreshes.

### Discord Log Automation (The "Discord Generator")
*   The app automates the creation of strictly formatted Discord logs required by EMS High Command.
*   Employees select their duty status, location, or action (e.g., "Going 10-9 (Break)"). The app auto-generates the correct log message, auto-copies it to the clipboard, and can optionally open the relevant Discord channel via deep-linking in one click.

### Radio Codes & Comms Library
*   A comprehensive library of "10-Codes" and department communications.
*   Users can input dynamic variables (like their current location or the name of the person replacing them). The app instantly updates all copy-paste templates to reflect these variables, ensuring fast and accurate radio broadcasts.

### "State Wave" Recruitment Assistant
*   A multi-step, sequential guide for conducting EMS recruitment waves.
*   Ensures that employees follow the exact script and timing protocols required for hiring events, broken down into manageable, copy-paste steps.

---

## 2. Technical Architecture

### "Zero-Backend" State Management
*   The application operates entirely on the client side using HTML, CSS (Vanilla), and JavaScript.
*   It utilizes the browser's `localStorage` to persist user settings, discord channel IDs, custom commands, and active timer states.

### Data Portability
*   **Export/Import Engine:** Recognizing the limitations of `localStorage`, the app features a built-in backup system. Employees can export their entire configuration as a `db.txt` file and import it across different browsers or devices.

### Dynamic Template Engine
*   The UI employs a robust, lightweight templating system. When a user updates a global input (e.g., `Location` = "PH Front"), the JavaScript engine iterates through all `.copy-content` DOM elements, replacing placeholders (`{LOC}`, `{REP}`, `{NAME}`) with the live data.

### Deep Linking Integration
*   The app heavily utilizes Discord deep-linking (`discord://-/channels/SERVER_ID/CHANNEL_ID`).
*   This integration bridges the gap between the web toolkit and the external communication platform, creating a seamless workflow.

---

## 3. Customizability
The Settings modal allows users to configure and test their own Discord Server IDs and Channel IDs. This makes the tool highly adaptable to any structural changes within the EMS organization's Discord server without requiring code updates.
