# 🚑 GTA V GRP EMS Assist

![Project Header](https://img.shields.io/badge/Project-GTA_V_GRP_EMS_Assist-blue)
![Version](https://img.shields.io/badge/Version-1.0-green)

Welcome to the **GTA V GRP EMS Assist** repository! This project is a comprehensive suite of front-end applications built for the Grand RP (GRP) EMS faction. It provides a cohesive ecosystem of tools for everyday duties, HR management, and shift tracking.

---

## 🏗️ Project Ecosystem

The ecosystem consists of three interconnected web-based applications:

1. **Employee Companion** 🩺
2. **HRMS (Human Resources Management System)** 📊
3. **Shift Guide** ⏱️

### Ecosystem Architecture

```mermaid
graph TD;
    Discord[Discord Logs] -->|Copied Manually| HRMS[HRMS Portal]
    HRMS -->|Calculates payouts, tracks hours| Leaderboard[Bonus & Payout Leaderboard]
    
    Duty[EMS On Duty] --> ShiftGuide[Shift Guide Timer]
    Duty --> EmployeeCompanion[Employee Companion Dashboard]
    
    ShiftGuide -->|Shift Tracking| Duty
    EmployeeCompanion -->|In-Game Tasks| Duty
```

---

## 1. 🩺 Employee Companion

The **Employee Companion** is a lightweight dashboard designed for on-the-go or secondary-monitor use by an EMS employee. It tracks ongoing medical procedures, task progress, and other real-time details required on duty.

### ✨ Features
- **Visual Progress Tracker**: Provides an aesthetic progress bar tracking ongoing tasks and duty milestones.
- **Glassmorphism UI**: Uses a blurred overlay for a sleek, modern UI.
- **Top Status Bar**: At-a-glance status metrics for the current shift.

### 🖼️ Wireframe

```mermaid
block-beta
    columns 1
    space
    block:TopBar
        columns 3
        Status["[Duty Status]"]
        Time["[Current Time]"]
        User["[User Profile]"]
    end
    space
    block:MainContent
        columns 1
        Title("Active Tasks & Progress")
        ProgressBar["[================>    ] 75%"]
        Details["Task Details / Current Assignment"]
    end
    space
    Footer["EMS Employee Dashboard - Active"]
```

---

## 2. 📊 HRMS (Human Resources Management System)

The **HRMS Portal** is the administrative powerhouse of the EMS faction. Designed for High Command and management, it ingests shift logs, calculates base wages, applies complex bonus structures, and maintains a roster of employees.

### ✨ Features
- **Discord Log Ingestion**: Parses raw Discord "On/Off Duty" logs using fuzzy-matching and regex.
- **Automated Payout Calculations**: Factors in day/night shifts, specific locations (PH front, SH, Labs, Calls), and base wages ($1,300/hr).
- **Timezone Normalization**: Automatically converts IST log timestamps to BST for accurate night shift bonuses.
- **Data Persistence**: Uses encrypted Browser `LocalStorage` via CryptoJS.

### 🖼️ Wireframe

```mermaid
block-beta
    columns 4
    Nav["Sidebar Navigation\n- Dashboard\n- Roster\n- Logs\n- Payouts"]:1
    block:MainArea:3
        columns 1
        Header("HRMS Dashboard (Admin Portal)")
        block:Stats
            columns 3
            TLogs["Total Logs"]
            THours["Total Hours"]
            TPayouts["Total Payouts"]
        end
        LogInput["[Text Area for Discord Logs]\n[Submit Button]"]
        DataTable["Data Table (Name, Rank, Hours, Bonus)"]
    end
```

---

## 3. ⏱️ Shift Guide

The **Shift Guide** focuses strictly on time management for individual shifts. It acts as a dedicated overlay or companion app that ensures employees meet their hourly quotas and avoid accidental short-shifting.

### ✨ Features
- **Shift Duration Timer**: Counts down or up depending on duty status.
- **Quota Tracking**: Visual indicators if minimum required time is met.
- **Modern Styling**: Styled identically to the Employee Companion for a unified aesthetic.

### 🖼️ Wireframe

```mermaid
block-beta
    columns 1
    Header("Shift Guide")
    space
    block:Timer
        columns 1
        Label("Current Shift Duration")
        TimeDisplay("02:45:30")
    end
    space
    block:Controls
        columns 2
        Btn1("Start Shift")
        Btn2("End Shift")
    end
```

---

## 🛠️ Technology Stack
- **HTML5 & CSS3**: Core layout and styling (Glassmorphism aesthetics).
- **Vanilla JavaScript**: All business logic, parsers, and timers.
- **Tailwind CSS**: Rapid UI development (used extensively in the HRMS).
- **CryptoJS**: LocalStorage encryption for HRMS data security.
