# EMS Shift Guide

## Overview & Value Proposition
The **EMS Shift Guide** is a structured, wizard-based web application built to enforce Standard Operating Procedures (SOPs) for Emergency Medical Services (EMS) personnel during the critical moments of starting and ending their shifts.

**For Investors & Open Source Contributors:** The Shift Guide solves a major compliance and training issue in simulation environments: ensuring personnel follow a strict sequence of actions before going on duty or off duty. By utilizing a "locked step" wizard interface, the app guarantees that no crucial step (like activating a bodycam or announcing a radio code) is skipped, resulting in higher operational compliance and fewer administrative headaches for High Command.

---

## 1. Key Features

### "Start Day" & "End Day" Wizards
*   The core UI consists of sequential, step-by-step wizards.
*   **Sequential Locking:** Users cannot proceed to Step 2 until they have successfully completed and acknowledged Step 1. This enforced flow ensures absolute compliance with departmental protocols.
*   Checklists include setting duty locations, acknowledging uniform/equipment codes, activating bodycams (with copy-paste commands), and dispatching radio logs.

### Dynamic Context Adaptation
*   The wizard adapts based on user inputs. For example, selecting a specific EMS Sub-Department (e.g., "LT - Lab Tech" vs "HS - Hospital Staff") may adjust the required steps or instructions, ensuring the guide remains relevant to the employee's specific role.

### Integrated Shift Timer
*   A built-in progress bar and shift timer visually represent the employee's time on duty.
*   The timer acts as a psychological anchor, keeping the employee aware of their shift duration for accurate payroll logging.

---

## 2. Technical Architecture

### UI & UX Design Principles
*   **Glassmorphism Aesthetic:** The application uses modern CSS techniques (backdrop filters, semi-transparent panels) to create a premium, immersive interface that encourages engagement.
*   **Frictionless Copy-Paste:** Like its companion apps, the Shift Guide heavily utilizes one-click copy buttons linked to hidden content templates, minimizing the time employees spend typing repetitive commands.

### State Persistence & Reactivity
*   Built with Vanilla JavaScript (`script.js`), the app manages its state using the browser's `localStorage`.
*   If an employee accidentally closes the tab mid-shift, their wizard progress, inputted variables (like vehicle plate numbers), and shift timer are instantly restored upon reopening the application.

### Template Variable Injection
*   The app features a reactive templating system. When an employee inputs their Name, ID, or Location at the start of the wizard, those values are dynamically injected into the copy-paste templates in all subsequent steps (replacing placeholders like `{LOC}` or `{ID}`).

---

## 3. Operational Impact
By standardizing the most error-prone parts of an EMS shift (clocking in and out), the Shift Guide drastically reduces the workload on Human Resources and High Command. It ensures that logs sent to the Discord servers are consistently formatted and structurally sound, which in turn allows the **EMS HRMS Application** to parse those logs with near 100% accuracy.
