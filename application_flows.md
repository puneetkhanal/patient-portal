# Patient Portal Application - Visual Flow Diagrams

This document contains visual representations of all unique flows in the Blood Transfusion Planning & Tracking application.

## 1. Authentication & Authorization Flow

```mermaid
flowchart TD
    A[User Access Application] --> B{Login Required?}
    B -->|Yes| C[Login Form]
    B -->|No| D[Public Content]

    C --> E[Validate Credentials]
    E --> F{Valid?}
    F -->|Yes| G[Check User Role]
    F -->|No| H[Show Error]

    G --> I{Super Admin?}
    G --> J{Data Entry?}
    G --> K{Analyst?}

    I --> L[Full Access: Admin + Data Entry + Analytics]
    J --> M[Data Entry Access: Patients, Requests, Plans, Confirmations]
    K --> N[Analytics Only: Reports & Dashboards]

    L --> O[Navigate to Dashboard]
    M --> O
    N --> P[Navigate to Reports]

    H --> C
```

## 2. Patient Management Flow

```mermaid
flowchart TD
    A[Patient Management] --> B{Action Type}
    B --> C[Register New Patient]
    B --> D[View Patient List]
    B --> E[View Patient Details]

    C --> F[Patient Registration Form]
    F --> G[Validate Required Fields]
    G --> H{Valid?}
    H -->|Yes| I[Save to Database]
    H -->|No| J[Show Validation Errors]

    I --> K[Success Message]
    K --> L[Redirect to Patient List]

    D --> M[Patients List Component]
    M --> N{User Action}
    N --> O[Search/Filter Patients]
    N --> P[Select Patient]

    P --> E

    E --> Q[Patient Detail View]
    Q --> R{User Role Check}
    R -->|Data Entry/Admin| S[Edit Patient Info]
    R -->|Analyst| T[View Only]

    S --> U[Update Patient Data]
    U --> V[Audit Log Entry]
    V --> W[Success Message]
```

## 3. Weekly Request Creation Flow (Friday Requests)

```mermaid
flowchart TD
    A[Friday Requests Page] --> B{Check Day of Week}
    B -->|Friday| C[Allow Request Creation]
    B -->|Not Friday| D[Show Warning + Allow with Back-Entry]

    C --> E[Patient Lookup/Auto-fill]
    D --> E

    E --> F[Request Form]
    F --> G[Select Patient]
    G --> H[Validate One Request Per Week]
    H --> I{Valid?}
    I -->|Yes| J[Fill Request Details]
    I -->|No| K[Show Error: Already Exists]

    J --> L[Units: 1 or 2]
    L --> M[Select Hospital]
    M --> N[Preferred Day - Optional]
    N --> O[Remarks - Optional]

    O --> P[Submit Request]
    P --> Q{Back-Entry Warning?}
    Q -->|Yes| R[Show Warning Dialog]
    Q -->|No| S[Create Request]

    R --> T{User Confirms?}
    T -->|Yes| S
    T -->|No| U[Cancel]

    S --> V[Save to Database]
    V --> W[Audit Log]
    W --> X[Success Message]
    X --> Y[Redirect to Requests List]
```

## 4. Weekly Planning Flow

```mermaid
flowchart TD
    A[Weekly Plan Page] --> B{User Role Check}
    B -->|Data Entry/Admin| C[Allow Plan Creation]
    B -->|Analyst| D[View Only Mode]

    C --> E[Select Week]
    E --> F[Load Pending Requests]
    F --> G{Requests Available?}
    G -->|Yes| H[Create Plan from Requests]
    G -->|No| I[Show Empty State]

    H --> J[Plan Created: Draft Status]
    J --> K[Display Plan Items Table]

    K --> L{User Action}
    L --> M[Edit Hospital Assignment]
    L --> N[Edit Date Assignment]
    L --> O[Edit Units Assignment]
    L --> P[Add Notes]

    M --> Q[Update Plan Item]
    N --> Q
    O --> Q
    P --> Q

    Q --> R[Auto-save Changes]
    R --> S[Audit Log Entry]

    L --> T[Finalize Plan]
    T --> U[Change Status to Finalized]
    U --> V[Set Finalized Timestamp]

    L --> W[View Summary]
    W --> X[Calculate Totals]
    X --> Y[By Blood Group]
    X --> Z[By Hospital]
    X --> AA[By Date]
```

## 5. Transfusion Confirmation Flow

```mermaid
flowchart TD
    A[Transfusion Confirmation Page] --> B[Load Scheduled Transfusions]
    B --> C{Items Available?}
    C -->|Yes| D[Display Confirmation Table]
    C -->|No| E[Show Empty State]

    D --> F{User Action}
    F --> G[Mark as Completed]
    F --> H[Mark as Postponed]
    F --> I[Mark as Cancelled]

    G --> J[Confirmation Dialog]
    H --> J
    I --> J

    J --> K{User Confirms?}
    K -->|Yes| L[Record Actual Date]
    K -->|No| M[Cancel Action]

    L --> N[Record Units Transfused]
    N --> O[Select Outcome]
    O --> P{Outcome Type}
    P --> Q[Completed]
    P --> R[Postponed]
    P --> S[Cancelled]

    Q --> T[Add Success Notes]
    R --> U[Add Postpone Reason]
    S --> V[Add Cancellation Reason]

    T --> W[Create Transfusion Record]
    U --> W
    V --> W

    W --> X[Update Plan Item Status]
    X --> Y[Audit Log Entry]
    Y --> Z[Success Message]
    Z --> AA[Refresh Table]
```

## 6. Email & Communication Flow

```mermaid
flowchart TD
    A[Weekly Summary Page] --> B[Load Current Week Plan]
    B --> C{Plan Exists?}
    C -->|Yes| D[Generate Summary Data]
    C -->|No| E[Show No Plan Message]

    D --> F[Calculate Totals]
    F --> G[By Blood Group]
    F --> H[By Hospital]
    F --> I[By Date]

    G --> J[Display Summary Table]
    H --> J
    I --> J

    J --> K{User Action}
    K --> L[Send Email]
    K --> M[Export to Excel]
    K --> N[Export to PDF]

    L --> O[Email Composition]
    O --> P[Default Recipients from Settings]
    P --> Q[Optional Override Recipients]

    Q --> R[Generate Email Content]
    R --> S[Subject: Weekly Blood Requirement]
    S --> T[Body: Summary Tables]

    T --> U{Attachment Type}
    U --> V[Excel Attachment]
    U --> W[PDF Attachment]

    V --> X[Generate Excel File]
    W --> Y[Generate PDF File]

    X --> Z[Send Email via API]
    Y --> Z

    Z --> AA{Email Sent Successfully?}
    AA -->|Yes| BB[Update Plan Status: Sent]
    AA -->|No| CC[Show Error Message]

    BB --> DD[Record Sent Timestamp]
    DD --> EE[Audit Log Entry]
    EE --> FF[Success Message]
```

## 7. Analytics & Reporting Flow

```mermaid
flowchart TD
    A[Reports Dashboard] --> B{User Role Check}
    B -->|Analyst/Admin| C[Allow Full Access]
    B -->|Data Entry| D[Access Denied]

    C --> E[Select Report Type]
    E --> F{Report Category}
    F --> G[Frequency Analysis]
    F --> H[Shortage Analysis]
    F --> I[Hospital Load Analysis]
    F --> J[Transfusion Trends]

    G --> K[Select Time Range]
    H --> K
    I --> K
    J --> K

    K --> L[Apply Filters]
    L --> M[Optional: By Hospital]
    M --> N[Optional: By Blood Group]
    N --> O[Optional: By Date Range]

    O --> P[Generate Report Data]
    P --> Q{Data Available?}
    Q -->|Yes| R[Display Results]
    Q -->|No| S[Show No Data Message]

    R --> T[Visual Charts]
    T --> U[Tables]
    T --> V[Export Options]

    U --> W[Export to CSV]
    V --> W

    W --> X[Download File]
    X --> Y[Audit Log: Report Accessed]
```

## 8. Settings Management Flow

```mermaid
flowchart TD
    A[Settings Page] --> B{User Role Check}
    B -->|Super Admin| C[Allow Settings Access]
    B -->|Other Roles| D[Access Denied]

    C --> E[Load Current Settings]
    E --> F[Display Settings Form]

    F --> G{Setting Category}
    G --> H[Week Configuration]
    G --> I[Back-Entry Settings]
    G --> J[Hospital List]
    G --> K[Blood Groups]
    G --> L[Email Recipients]

    H --> M[Week Start Day: Sunday/Monday/etc]
    H --> N[Time Zone: IANA String]

    I --> O[Allow Back Entry: Boolean]
    I --> P[Warning Days: Number]

    J --> Q[Add/Edit Hospital Names]
    K --> R[Add/Edit Blood Groups]

    L --> S[Recipient Management]
    S --> T[Add New Recipient]
    T --> U[Name + Email]
    U --> V[Set Active/Inactive]

    V --> W[Save Changes]
    W --> X{Validation Passed?}
    X -->|Yes| Y[Update Database]
    X -->|No| Z[Show Errors]

    Y --> AA[Audit Log: Settings Changed]
    AA --> BB[Success Message]
    BB --> CC[Reload Settings]
```

## Summary of Key Integration Points

```mermaid
flowchart TD
    A[Patient Registration] --> B[Weekly Requests]
    B --> C[Weekly Plans]
    C --> D[Transfusion Confirmations]

    E[Settings] --> F[All Modules]
    F --> B
    F --> C
    F --> G[Email Recipients]

    C --> H[Weekly Summary]
    H --> I[Email Sending]

    D --> J[Analytics Reports]
    C --> J
    B --> J

    K[User Authentication] --> L[Role-Based Access]
    L --> M[Patient Management]
    L --> B
    L --> C
    L --> H
    L --> J
    L --> E

    N[Audit Logging] --> O[All Write Operations]
    O --> B
    O --> C
    O --> D
    O --> I
    O --> E
```

These diagrams represent the complete workflow of the Blood Transfusion Planning & Tracking system, showing how all components interact and the user journeys through different roles and functionalities.