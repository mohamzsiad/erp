# CloudERP Flutter Mobile Application — Build Prompt

## Context

You are building a Flutter mobile application for **CloudERP** — an ERP system for **Al Wadi Construction LLC**, a construction company in Muscat, Oman. The backend is a Node.js/Fastify REST API already running at a configurable base URL. The mobile app consumes the existing REST API and must mirror the web application's feature set in a mobile-first design.

The codebase for the Flutter app must be created at the **root of the current working directory** as a folder named `erp_mobile`.

---

## 1. PROJECT SETUP

### Create the Flutter project

```bash
flutter create erp_mobile --org com.alwadi.erp --platforms android,ios
cd erp_mobile
```

### pubspec.yaml dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  # State management
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5
  # Navigation
  go_router: ^13.2.0
  # HTTP & Auth
  dio: ^5.4.3
  flutter_secure_storage: ^9.0.0
  # UI
  google_fonts: ^6.2.1
  flutter_svg: ^2.0.10+1
  cached_network_image: ^3.3.1
  shimmer: ^3.0.0
  # Charts
  fl_chart: ^0.68.0
  # Forms
  reactive_forms: ^17.0.0
  # Utilities
  intl: ^0.19.0
  equatable: ^2.0.5
  freezed_annotation: ^2.4.1
  json_annotation: ^4.9.0
  collection: ^1.18.0
  # Offline & persistence
  hive_flutter: ^1.1.0
  hive: ^2.2.3
  # File / PDF
  open_filex: ^4.5.0
  path_provider: ^2.1.3
  # Connectivity
  connectivity_plus: ^6.0.3
  # Notifications (local)
  flutter_local_notifications: ^17.1.2
  # Date picker
  table_calendar: ^3.1.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.9
  riverpod_generator: ^2.3.11
  freezed: ^2.5.2
  json_serializable: ^6.7.1
  flutter_launcher_icons: ^0.13.1
```

---

## 2. ARCHITECTURE

Use **Clean Architecture** with the following layer structure:

```
lib/
├── main.dart
├── app.dart                      # MaterialApp, GoRouter, ProviderScope
├── core/
│   ├── api/
│   │   ├── api_client.dart       # Dio singleton with interceptors
│   │   ├── api_constants.dart    # Base URL, endpoints
│   │   └── interceptors/
│   │       ├── auth_interceptor.dart   # Attach Bearer token, refresh on 401
│   │       └── error_interceptor.dart  # Map HTTP errors to AppException
│   ├── auth/
│   │   ├── auth_provider.dart    # Riverpod notifier — login, logout, refresh
│   │   ├── auth_state.dart       # AuthState (unauthenticated, authenticated, loading)
│   │   ├── token_storage.dart    # FlutterSecureStorage wrapper
│   │   └── models/
│   │       ├── login_response.dart
│   │       ├── auth_user.dart
│   │       └── permission_set.dart
│   ├── models/
│   │   └── paginated_response.dart
│   ├── theme/
│   │   ├── app_theme.dart        # ThemeData — colours, typography, component styles
│   │   └── app_colours.dart      # Brand palette constants
│   ├── widgets/
│   │   ├── app_bar.dart
│   │   ├── bottom_nav.dart
│   │   ├── status_badge.dart     # Colour-coded doc status chip
│   │   ├── kpi_card.dart
│   │   ├── document_list_tile.dart
│   │   ├── empty_state.dart
│   │   ├── error_state.dart
│   │   ├── loading_shimmer.dart
│   │   ├── confirm_dialog.dart
│   │   ├── amount_text.dart      # Formats OMR decimals consistently
│   │   └── search_bar_delegate.dart
│   ├── router/
│   │   ├── app_router.dart       # GoRouter with guard
│   │   └── route_names.dart
│   └── utils/
│       ├── date_utils.dart
│       ├── format_utils.dart     # OMR currency, qty formatting
│       └── permission_utils.dart
│
├── features/
│   ├── dashboard/
│   ├── procurement/
│   │   ├── mrl/
│   │   ├── prl/
│   │   ├── enquiry/
│   │   ├── quotation/
│   │   └── po/
│   ├── inventory/
│   │   ├── items/
│   │   ├── grn/
│   │   ├── issue/
│   │   ├── transfer/
│   │   └── stock/
│   ├── finance/
│   │   ├── ap/
│   │   ├── ar/
│   │   ├── journals/
│   │   └── budgets/
│   ├── approvals/
│   ├── notifications/
│   ├── ai_chat/
│   └── profile/
```

Each feature folder contains:
```
feature_name/
├── data/
│   ├── repositories/   # API calls via Dio
│   └── models/         # Freezed + json_serializable DTOs
├── providers/          # Riverpod providers / notifiers
└── ui/
    ├── screens/
    └── widgets/
```

---

## 3. BRAND & THEME

### Colour Palette (`app_colours.dart`)

```dart
class AppColours {
  // Primary brand — matches web sidebar
  static const Color primary         = Color(0xFF1F4E79);
  static const Color primaryLight    = Color(0xFF2E5F8A);
  static const Color primaryAccent   = Color(0xFF4472C4);

  // Status colours — mirror web StatusBadge
  static const Color statusDraft     = Color(0xFF6B7280); // gray-500
  static const Color statusSubmitted = Color(0xFF3B82F6); // blue-500
  static const Color statusApproved  = Color(0xFF10B981); // green-500
  static const Color statusRejected  = Color(0xFFEF4444); // red-500
  static const Color statusCancelled = Color(0xFF9CA3AF); // gray-400
  static const Color statusPartial   = Color(0xFFF59E0B); // amber-500
  static const Color statusPosted    = Color(0xFF8B5CF6); // purple-500
  static const Color statusPaid      = Color(0xFF059669); // emerald-600
  static const Color statusClosed    = Color(0xFF374151); // gray-700

  // Surface
  static const Color surface         = Color(0xFFFFFFFF);
  static const Color background      = Color(0xFFF3F4F6);
  static const Color cardBorder      = Color(0xFFE5E7EB);

  // KPI tile accents
  static const Color kpiBlue         = Color(0xFFEFF6FF);
  static const Color kpiGreen        = Color(0xFFF0FDF4);
  static const Color kpiAmber        = Color(0xFFFFFBEB);
  static const Color kpiRed          = Color(0xFFFEF2F2);
  static const Color kpiPurple       = Color(0xFFF5F3FF);
}
```

### Typography
Use **Inter** font (via google_fonts). Apply it as the default font family in ThemeData.

---

## 4. API CLIENT & AUTH

### Base URL Configuration
Store `BASE_URL` in a `.env`-style `api_constants.dart`:
```dart
class ApiConstants {
  static const String baseUrl = 'http://YOUR_SERVER:3000/api/v1';
  // For Android emulator use: 'http://10.0.2.2:3000/api/v1'
  // For iOS simulator use: 'http://127.0.0.1:3000/api/v1'
}
```

### Dio Client (`api_client.dart`)
- Singleton Dio instance
- Base options: `connectTimeout: 15s`, `receiveTimeout: 30s`
- `AuthInterceptor`: reads access token from `TokenStorage`, adds `Authorization: Bearer <token>` header
- On **401 response**: automatically call `POST /auth/refresh` with stored refreshToken, update stored tokens, retry original request once. If refresh also fails, clear tokens and redirect to login via GoRouter
- `ErrorInterceptor`: convert Dio exceptions to typed `AppException(message, statusCode)`

### Auth Flow (`auth_provider.dart`)
- `AuthNotifier extends AsyncNotifier<AuthState>`
- **Login**: `POST /api/v1/auth/login` body `{ email, password }` → store `accessToken` + `refreshToken` in FlutterSecureStorage → populate `AuthUser` + `PermissionSet[]`
- **Logout**: `POST /api/v1/auth/logout` body `{ refreshToken }` → clear storage → redirect to login
- **Bootstrap**: on app start, read stored access token → verify it's not expired (decode JWT exp) → if valid, fetch user profile; if expired, attempt silent refresh

### JWT Payload Structure
```dart
// Decoded from JWT:
// { userId, companyId, roleId, email, iat, exp }
```

### Permissions
Store `PermissionSet[]` (module + resource + action) in the auth state. Provide a helper:
```dart
bool hasPermission(String module, String resource, String action)
```
Use this to show/hide buttons (approve, create, edit) throughout the app.

---

## 5. NAVIGATION (`app_router.dart`)

Use **GoRouter** with a redirect guard that checks `AuthState`.

```
/login                          → LoginScreen
/                               → redirect to /dashboard
/dashboard                      → DashboardScreen
/approvals                      → ApprovalsScreen
/notifications                  → NotificationsScreen
/ai-chat                        → AiChatScreen

/procurement/mrl                → MrlListScreen
/procurement/mrl/new            → MrlFormScreen
/procurement/mrl/:id            → MrlDetailScreen

/procurement/prl                → PrlListScreen
/procurement/prl/new            → PrlFormScreen
/procurement/prl/:id            → PrlDetailScreen

/procurement/po                 → PoListScreen
/procurement/po/new             → PoFormScreen
/procurement/po/:id             → PoDetailScreen

/inventory/items                → ItemListScreen
/inventory/items/:id            → ItemDetailScreen
/inventory/grn                  → GrnListScreen
/inventory/grn/:id              → GrnDetailScreen
/inventory/issue                → IssueListScreen
/inventory/stock                → StockSummaryScreen

/finance/ap/invoices            → ApInvoiceListScreen
/finance/ap/invoices/:id        → ApInvoiceDetailScreen
/finance/ap/payments            → ApPaymentListScreen
/finance/ar/invoices            → ArInvoiceListScreen
/finance/journals               → JournalListScreen
/finance/budgets                → BudgetScreen

/profile                        → ProfileScreen
```

### Bottom Navigation (5 tabs)
1. **Dashboard** — LayoutDashboard icon
2. **Procurement** — ShoppingCart icon
3. **Inventory** — Package icon
4. **Finance** — DollarSign icon
5. **More** — opens a drawer with: Approvals, AI Chat, Notifications, Profile

---

## 6. SCREENS — DETAILED SPECIFICATIONS

---

### 6.1 LOGIN SCREEN

**Route:** `/login`

**UI:**
- Full-screen gradient background: `primary` → `primaryLight`
- Centred card (white, rounded-2xl, shadow-lg)
- Company logo placeholder (SVG icon + "CloudERP" text)
- "Al Wadi Construction LLC" subtitle
- Email field (keyboard type: email)
- Password field (obscureText, visibility toggle)
- "Sign In" button (full-width, primary colour)
- Error snackbar on invalid credentials
- Loading state on the button while request is in flight

**API:** `POST /api/v1/auth/login` → `{ email, password }`

**Response shape:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id", "email", "firstName", "lastName", "companyId", "roleId", "roleName", "enabledModules" },
  "permissions": [{ "module", "resource", "action" }]
}
```

---

### 6.2 DASHBOARD SCREEN

**Route:** `/dashboard`

**API:** `GET /api/v1/dashboard/kpis` and `GET /api/v1/dashboard/workflow-tasks`

**KPI Response shape:**
```json
{
  "procurement": {
    "pendingPrCount": 3,
    "pendingPoCount": 2,
    "pendingPoValue": 45600.000,
    "overduePoCount": 1
  },
  "inventory": {
    "totalStockValue": 182400.000,
    "lowStockCount": 5,
    "pendingGrnCount": 2,
    "deadStockValue": 3200.000
  },
  "finance": {
    "totalApOutstanding": 87500.000,
    "totalArOutstanding": 245000.000,
    "overdueApCount": 3,
    "overdueArCount": 1,
    "monthlyRevenue": 182500.000,
    "monthlyExpense": 42650.000
  },
  "recentActivity": []
}
```

**UI Layout:**
- `SliverAppBar` with company name and notification bell (badge with unread count)
- **Section: "My Work"** — horizontal scrollable row of action cards:
  - Pending PRs, Pending POs, Pending GRNs, Pending AP Invoices (tap → navigates to filtered list)
- **Section: "Finance Overview"** — 2×2 grid of KPI cards:
  - AP Outstanding (red accent), AR Outstanding (green), Monthly Revenue (blue), Monthly Expense (amber)
- **Section: "Inventory"** — 2×2 grid: Total Stock Value, Low Stock Items, Pending GRNs, Dead Stock Value
- **Section: "Pending Approvals"** — list of `WorkflowTask` items with approve/reject swipe actions
- **Section: "Quick Actions"** — grid of shortcut buttons: New PR, New GRN, New AP Invoice, Check Stock

**WorkflowTask shape:**
```json
{
  "docType": "PRL",
  "docId": "...",
  "docNo": "PR-2025-0005",
  "subject": "Fencing – Muscat boundary",
  "requestedBy": "System Administrator",
  "requestedAt": "2025-03-03",
  "status": "SUBMITTED",
  "priority": "high"
}
```

---

### 6.3 APPROVALS SCREEN

**Route:** `/approvals`

**API:** `GET /api/v1/workflow/my-tasks`
**Approve/Reject:** `POST /api/v1/workflow/approve` body `{ docType, docId, action: 'APPROVE'|'REJECT', comment? }`

**UI:**
- Segmented control: All | PRL | PO | MRL | GRN
- Each task as a card showing: doc type badge, doc number, subject, requested-by, date, priority badge
- **Swipe right** → green Approve action
- **Swipe left** → red Reject action (opens bottom sheet for rejection comment)
- Tap card → navigates to the relevant detail screen

---

### 6.4 PROCUREMENT MODULE

#### 6.4.1 Material Requisition (MRL)

**List API:** `GET /api/v1/procurement/mrl?page=1&limit=20&status=&search=`
**Detail API:** `GET /api/v1/procurement/mrl/:id`
**Create API:** `POST /api/v1/procurement/mrl`
**Submit API:** `POST /api/v1/procurement/mrl/:id/submit`
**Approve API:** `POST /api/v1/procurement/mrl/:id/approve`

**MRL model:**
```dart
// Key fields:
// id, companyId, docNo, docDate, deliveryDate
// locationId, chargeCodeId, mrlId?, remarks
// status: DRAFT | SUBMITTED | APPROVED | REJECTED | CONVERTED | CLOSED
// lines: MrlLine[]
//   - itemId, itemCode, itemDescription, uomId, uomCode
//   - requestedQty, approvedQty, approxPrice, freeStock
```

**List Screen:**
- Search bar + filter chips: All, Draft, Submitted, Approved
- Pull-to-refresh, infinite scroll (pagination)
- Each tile: doc number (bold), status badge, location, date, line count, total approx value

**Detail / Form Screen:**
- Header card: Doc No, Date, Delivery Date, Location, Charge Code, Remarks
- Line items list: item code + description, UOM, qty, approx price
- Action buttons based on status and permissions:
  - DRAFT → "Submit for Approval" (requires PROCUREMENT > MRL > EDIT)
  - SUBMITTED → "Approve" / "Reject" (requires PROCUREMENT > MRL > APPROVE)

---

#### 6.4.2 Purchase Requisition (PRL)

**List API:** `GET /api/v1/procurement/prl?page=1&limit=20&status=&search=`
**Detail API:** `GET /api/v1/procurement/prl/:id`
**Create API:** `POST /api/v1/procurement/prl`
**Submit:** `POST /api/v1/procurement/prl/:id/submit`
**Approve:** `POST /api/v1/procurement/prl/:id/approve`

**PRL model (key fields):**
```dart
// id, docNo, docDate, deliveryDate, locationId, chargeCodeId
// mrlId?, remarks, status: DRAFT|SUBMITTED|APPROVED|REJECTED|ENQUIRY_SENT|PO_CREATED|CLOSED
// lines: PrlLine[]
//   - itemId, itemCode, itemDescription, grade1?, grade2?
//   - uomId, requestedQty, approvedQty, approxPrice, freeStock
//   - shortCloseStatus: NONE|PARTIAL|FULL
//   - leadTimeDays?, expectedDeliveryDate?
```

**List Screen:** Same pattern as MRL. Status chips include: ENQUIRY_SENT, PO_CREATED.

**Detail Screen:**
- Tab bar: **Details** | **Lines** | **Sub-Sections**
- Details tab: header fields (doc no, dates, location, charge code, MRL ref, remarks)
- Lines tab: scrollable list of line items with qty/price summary at bottom
- Sub-Sections tab (for selected line): mini tabs for Delivery Schedule, A/C Details, Alternate Items, Item Status, Short Close, Lead Time
  - **Delivery Schedule**: list of `{ deliveryDate, qty, locationName, remarks }` from `GET /api/v1/procurement/prl/:prlId/lines/:lineId/delivery-schedules`
  - **A/C Details**: list of `{ glAccountCode, glAccountName, costCentreName, percentage, amount, budgetYear }` from `GET /api/v1/procurement/prl/:prlId/lines/:lineId/account-details`
  - **Alternate Items**: list of `{ itemCode, itemDescription, priority, approxPrice, uom, remarks }` from `GET /api/v1/procurement/prl/:prlId/lines/:lineId/alternate-items`
  - **Item Status**: tiles showing `{ onHandQty, reservedQty, availableQty, onOrderQty, onPOQty }` from `GET /api/v1/procurement/prl/:prlId/lines/:lineId/item-status`
  - **Short Close**: status card with `{ shortCloseStatus, shortClosedQty, shortCloseReason, shortClosedAt }` from `GET /api/v1/procurement/prl/:prlId/lines/:lineId/short-close`
  - **Lead Time**: card showing `{ leadTimeDays, expectedDeliveryDate, leadTimeSource }` from `GET /api/v1/procurement/prl/:prlId/lines/:lineId/lead-time`

---

#### 6.4.3 Purchase Order (PO)

**List API:** `GET /api/v1/procurement/po?page=1&limit=20&status=&search=`
**Detail API:** `GET /api/v1/procurement/po/:id`
**Create API:** `POST /api/v1/procurement/po`
**Submit:** `POST /api/v1/procurement/po/:id/submit`
**Approve:** `POST /api/v1/procurement/po/:id/approve`

**PO model (key fields):**
```dart
// id, docNo, docDate, deliveryDate, supplierId, supplierName
// currencyId, exchangeRate, totalAmount, paymentTerms
// status: DRAFT|SUBMITTED|APPROVED|PARTIAL|RECEIVED|INVOICED|CLOSED|CANCELLED
// lines: PoLine[]
//   - itemId, itemCode, itemDescription, uomId
//   - orderedQty, receivedQty, unitPrice, discountPct, taxPct, netAmount
//   - chargeCodeId, chargeCodeName
```

**List Screen:** Filter chips by status. Each tile shows supplier name, doc no, total amount (OMR), status badge, delivery date.

**Detail Screen:**
- Header: supplier, currency, payment terms, dates, total
- Line items in a scrollable table with columns: item, ordered qty, received qty, unit price, net amount
- Action buttons: Submit / Approve / Reject / Close based on status + permissions

---

### 6.5 INVENTORY MODULE

#### 6.5.1 Items

**List API:** `GET /api/v1/inventory/items?search=&categoryId=&status=ACTIVE&page=1&limit=20`
**Detail API:** `GET /api/v1/inventory/items/:id`

**Item model:**
```dart
// id, code, description, shortDescription, categoryId, categoryName
// uomId, uomCode, standardCost, reorderLevel, reorderQty
// status: ACTIVE|INACTIVE|DISCONTINUED
// grade1Options: [], grade2Options: []
```

**List Screen:** Search by code/description. Filter by category. Each tile: item code (monospace), description, UOM, standard cost, status badge.

**Detail Screen:** Full item card + stock balance section fetched from `GET /api/v1/inventory/stock-summary` filtered by item.

---

#### 6.5.2 Goods Receipt Note (GRN)

**List API:** `GET /api/v1/inventory/grn?status=&supplierId=&poId=&page=1&limit=20`
**Detail API:** `GET /api/v1/inventory/grn/:id`
**Create API:** `POST /api/v1/inventory/grn`
**Post API:** `POST /api/v1/inventory/grn/:id/post`

**GRN model:**
```dart
// id, docNo, docDate, poId, poNo, supplierId, supplierName
// warehouseId, warehouseName, status: DRAFT|POSTED|CANCELLED
// lines: GrnLine[]
//   - itemId, itemCode, itemDescription, poLineId
//   - receivedQty, acceptedQty, rejectedQty, binId, binName
//   - lotNo?, batchNo?, expiryDate?
```

**Create GRN Flow (mobile-optimised):**
1. Select PO (searchable dropdown)
2. App auto-populates lines from PO
3. User enters received/accepted/rejected quantities per line
4. Select bin per line
5. Post button → `POST /api/v1/inventory/grn/:id/post`

---

#### 6.5.3 Stock Issue

**List API:** `GET /api/v1/inventory/issue?status=&page=1&limit=20`
**Detail API:** `GET /api/v1/inventory/issue/:id`
**Create + Post API:** `POST /api/v1/inventory/issue`

**Model:** `{ docNo, docDate, warehouseId, chargeCodeId, mrlId?, status, lines: [{ itemId, issuedQty, binId, avgCost }] }`

---

#### 6.5.4 Stock Summary Screen

**API:** `GET /api/v1/inventory/stock-summary`

**UI:**
- Summary tiles at top: Total Stock Value, Low Stock Items, Dead Stock Value, Warehouses
- Searchable/filterable list of items with on-hand qty and value per warehouse
- Colour coding: red if qty ≤ reorder level, amber if qty ≤ 2× reorder level, green otherwise

---

### 6.6 FINANCE MODULE

#### 6.6.1 AP Invoices

**List API:** `GET /api/v1/finance/ap/invoices?status=&supplierId=&page=1&limit=20`
**Detail API:** `GET /api/v1/finance/ap/invoices/:id`
**Create API:** `POST /api/v1/finance/ap/invoices`

**AP Invoice model:**
```dart
// id, docNo, supplierId, supplierName, poId?, poNo?, grnId?, grnNo?
// supplierInvoiceNo, invoiceDate, dueDate
// amount, taxAmount, totalAmount, paidAmount
// status: DRAFT|SUBMITTED|APPROVED|PAID|CANCELLED
// matchFlag: MATCHED|MISMATCH|PENDING
```

**List Screen:** Each tile shows supplier name, invoice no, total amount, outstanding amount, due date (red if overdue), match flag badge.

**Detail Screen:** Header fields + allocation section showing linked payments.

---

#### 6.6.2 AP Payments

**List API:** `GET /api/v1/finance/ap/payments?supplierId=&page=1&limit=20`
**Detail API:** `GET /api/v1/finance/ap/payments/:id`
**Create API:** `POST /api/v1/finance/ap/payments`

**Model:** `{ docNo, supplierId, paymentDate, amount, paymentMethod, status, allocations: [{ invoiceId, invoiceNo, amount }] }`

---

#### 6.6.3 AR Invoices

**List API:** `GET /api/v1/finance/ar/invoices?status=&customerId=&page=1&limit=20`
**Detail API:** `GET /api/v1/finance/ar/invoices/:id`

**Model:** `{ docNo, customerId, customerName, description, invoiceDate, dueDate, amount, taxAmount, totalAmount, paidAmount, status }`

---

#### 6.6.4 Journal Entries

**List API:** `GET /api/v1/finance/journals?status=&page=1&limit=20`
**Detail API:** `GET /api/v1/finance/journals/:id`

**Model:** `{ docNo, entryDate, description, sourceModule, status: DRAFT|POSTED|CANCELLED, lines: [{ accountCode, accountName, costCentreName, debit, credit, description }] }`

**Detail Screen:** Header + double-entry table (account | debit | credit) with totals row. Total debit must equal total credit.

---

#### 6.6.5 Budget vs Actual Screen

**API:** `GET /api/v1/finance/budgets?fiscalYear=2025`

**UI:** Bar chart (fl_chart) showing budget vs actual per cost centre per month. Toggle between monthly and annual view. Colour: blue for budget, green for actual (red if over budget).

---

### 6.7 NOTIFICATIONS SCREEN

**Unread count API:** `GET /api/v1/notifications/unread-count`
**List API:** `GET /api/v1/notifications?page=1&limit=20&unread=false`
**Mark read API:** `PATCH /api/v1/notifications/:id/read`
**Mark all read API:** `PATCH /api/v1/notifications/mark-all-read`

**Notification model:** `{ id, userId, title, message, type, isRead, createdAt, link? }`

**UI:**
- Two tabs: Unread | All
- Each notification as a `ListTile`: icon by type, title (bold if unread), message, relative time ("2 hours ago")
- Tap → mark as read + navigate to `link` if provided
- "Mark all as read" button in AppBar

---

### 6.8 AI CHAT SCREEN

**Route:** `/ai-chat`

**API:** `POST /api/v1/ai/chat` body `{ message: string, history: [{ role, content }][] }`

**Response:** `{ answer: string, data?: object[], chartHint?: 'bar'|'line'|'pie'|null }`

**UI:**
- Full-screen chat interface
- Messages scrollable list — user bubbles right (primary colour), assistant bubbles left (gray)
- When `data[]` is present: render a horizontal-scroll `DataTable` below the answer bubble
- When `chartHint` is `bar` or `line`: render a `BarChart` or `LineChart` (fl_chart) below the data table
- Floating text input bar at bottom with send button
- Typing indicator (three animated dots) while awaiting response
- Suggestion chips on empty state:
  - "Total spend this month?"
  - "Pending POs above 5,000 OMR"
  - "Which supplier has highest spend?"
  - "Stock value of REBAR-12MM"
  - "PRs pending approval"

---

### 6.9 PROFILE SCREEN

**UI:**
- User avatar (initials-based, primary colour background)
- Name, email, role name
- Company name
- Enabled modules chips
- "Change Password" (opens bottom sheet with current password + new password + confirm)
- "Sign Out" button (calls `POST /api/v1/auth/logout` then clears storage)

---

## 7. SHARED WIDGETS (detailed specs)

### StatusBadge
```dart
// Maps status string → colour + label
// DRAFT → gray, SUBMITTED → blue, APPROVED → green,
// REJECTED → red, CANCELLED → gray-light,
// PARTIAL → amber, POSTED → purple,
// PAID → emerald, CLOSED → dark-gray,
// PO_CREATED → indigo, ENQUIRY_SENT → sky
Widget statusBadge(String status) { ... }
```

### DocumentListTile
```dart
// Standardised tile for all document lists (MRL, PRL, PO, GRN, etc.)
// Leading: coloured icon based on docType
// Title: docNo (bold monospace) + status badge
// Subtitle: supplier/location + date
// Trailing: amount (OMR) formatted to 3 decimal places
```

### AmountText
```dart
// Always formats as "OMR 12,345.678"
// Optional: showCurrency=false → just "12,345.678"
// colour: red if negative, default otherwise
```

### LoadingShimmer
```dart
// Skeleton loader — 3–5 shimmer tiles matching DocumentListTile height
```

### ConfirmDialog
```dart
// show(context, title, message, confirmLabel, onConfirm)
// Used for Submit, Approve, Post, Short Close actions
```

---

## 8. DATA MODELS (Freezed + json_serializable)

Generate all models with `@freezed` and `@JsonSerializable`. Key models:

```dart
// auth_user.dart
@freezed class AuthUser with _$AuthUser {
  factory AuthUser({ required String id, required String email,
    required String firstName, required String lastName,
    required String companyId, required String roleId,
    required String roleName, required List<String> enabledModules }) = _AuthUser;
  factory AuthUser.fromJson(Map<String, dynamic> json) => _$AuthUserFromJson(json);
}

// paginated_response.dart
@freezed class PaginatedResponse<T> with _$PaginatedResponse<T> {
  factory PaginatedResponse({ required List<T> data, required int total,
    required int page, required int limit }) = _PaginatedResponse<T>;
}
```

Create equivalent Freezed models for:
- `MrlHeader`, `MrlLine`
- `PrlHeader`, `PrlLine`, `DeliverySchedule`, `AccountDetail`, `AlternateItem`, `ItemStatus`, `ShortCloseInfo`, `LeadTimeInfo`
- `PoHeader`, `PoLine`
- `GrnHeader`, `GrnLine`
- `StockIssueHeader`, `StockIssueLine`
- `Item`, `ItemCategory`, `Uom`
- `ApInvoice`, `ApPayment`, `ApAllocation`
- `ArInvoice`, `ArReceipt`
- `JournalEntry`, `JournalLine`
- `Budget`, `BudgetPeriod`
- `Supplier`, `SupplierContact`
- `WorkflowTask`
- `Notification`
- `ChatMessage`, `ChatResponse`
- `KpiData`

---

## 9. OFFLINE SUPPORT

Use **Hive** for local caching:
- Cache last-fetched list responses per endpoint (TTL: 5 minutes)
- Cache auth user + permissions after login
- Show cached data with a "Showing cached data" banner when offline (detected via `connectivity_plus`)
- Procurement list screens: cache up to 200 most recent records

```dart
// Hive box names
const kBoxAuth        = 'auth';
const kBoxMrl         = 'mrl_list';
const kBoxPrl         = 'prl_list';
const kBoxPo          = 'po_list';
const kBoxGrn         = 'grn_list';
const kBoxItems       = 'items_list';
const kBoxNotifications = 'notifications';
```

---

## 10. ERROR HANDLING

Global error handling pattern:
```dart
// Every API call wrapped in:
try {
  final result = await repository.fetchData();
  state = AsyncData(result);
} on AppException catch (e) {
  state = AsyncError(e, StackTrace.current);
}

// AppException:
class AppException implements Exception {
  final String message;
  final int?   statusCode;
  const AppException(this.message, [this.statusCode]);
}
```

- **400**: Show field-level validation errors inline on forms
- **401**: Trigger silent token refresh; if fails → logout
- **403**: Show "You don't have permission for this action" snackbar
- **404**: Show empty state with "Not found" message
- **500**: Show "Server error. Please try again." with retry button
- **Network error**: Show "No internet connection" banner with cached data

---

## 11. FORMS (using reactive_forms)

All create/edit forms use `ReactiveForm`. Key validation rules:

**PRL Create Form:**
```dart
FormGroup buildPrlForm() => fb.group({
  'locationId':    ['', Validators.required],
  'chargeCodeId':  ['', Validators.required],
  'docDate':       [DateTime.now(), Validators.required],
  'deliveryDate':  ['', Validators.required],
  'remarks':       [''],
  'lines':         fb.array([], Validators.minLength(1)),
});
```

**PO Create Form:** Similar with supplierId, currencyId, paymentTerms, lines (itemId, orderedQty, unitPrice, chargeCodeId).

**GRN Create Form:** Auto-populated from PO. Each line: receivedQty, acceptedQty, rejectedQty, binId.

All date fields use `showDatePicker`. All lookup fields (location, item, supplier, charge code) use a searchable bottom sheet that calls the relevant list API with a `search` query parameter.

---

## 12. CHARTS (fl_chart)

### Dashboard Finance Chart
`BarChart` with grouped bars: Monthly Revenue (blue) vs Monthly Expense (amber) for last 6 months.

### Budget vs Actual
`BarChart` grouped by month: Budget (blue-200) vs Actual (primary). Rod colour turns red if actual > budget.

### Stock Value Distribution
`PieChart` by item category — 5 slices with legend.

### AI Chat Charts
`BarChart` or `LineChart` rendered dynamically from `data[]` array — detect X axis key (first string column) and Y axis key (first numeric column).

---

## 13. ANDROID / IOS CONFIGURATION

### Android (`android/app/src/main/AndroidManifest.xml`)
Add permissions:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```
For local development, add `android:usesCleartextTraffic="true"` to `<application>`.

### iOS (`ios/Runner/Info.plist`)
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

### App Icons
Use `flutter_launcher_icons` with a dark-blue background (`#1F4E79`) and a white building/construction icon.

---

## 14. DELIVERABLES CHECKLIST

Build all of the following files:

**Core**
- [ ] `lib/main.dart`
- [ ] `lib/app.dart`
- [ ] `lib/core/api/api_client.dart`
- [ ] `lib/core/api/api_constants.dart`
- [ ] `lib/core/api/interceptors/auth_interceptor.dart`
- [ ] `lib/core/api/interceptors/error_interceptor.dart`
- [ ] `lib/core/auth/auth_provider.dart`
- [ ] `lib/core/auth/auth_state.dart`
- [ ] `lib/core/auth/token_storage.dart`
- [ ] `lib/core/auth/models/login_response.dart`
- [ ] `lib/core/auth/models/auth_user.dart`
- [ ] `lib/core/theme/app_theme.dart`
- [ ] `lib/core/theme/app_colours.dart`
- [ ] `lib/core/router/app_router.dart`
- [ ] `lib/core/widgets/` (all 10 shared widgets)
- [ ] `lib/core/utils/format_utils.dart`

**Features**
- [ ] `lib/features/dashboard/` — screen, providers, models
- [ ] `lib/features/approvals/` — screen, providers
- [ ] `lib/features/procurement/mrl/` — list, detail, form screens + providers + models
- [ ] `lib/features/procurement/prl/` — list, detail, form + all 6 sub-section widgets
- [ ] `lib/features/procurement/po/` — list, detail, form screens
- [ ] `lib/features/inventory/items/` — list, detail screens
- [ ] `lib/features/inventory/grn/` — list, detail, create screens
- [ ] `lib/features/inventory/issue/` — list, detail, create screens
- [ ] `lib/features/inventory/stock/` — summary screen
- [ ] `lib/features/finance/ap/` — invoice list/detail, payment list/detail
- [ ] `lib/features/finance/ar/` — invoice list/detail
- [ ] `lib/features/finance/journals/` — list, detail
- [ ] `lib/features/finance/budgets/` — budget vs actual screen
- [ ] `lib/features/notifications/` — screen, providers
- [ ] `lib/features/ai_chat/` — chat screen, providers
- [ ] `lib/features/profile/` — profile screen

---

## 15. ADDITIONAL INSTRUCTIONS

1. **Implement all files fully** — do not use placeholder `// TODO` comments. Every screen must be functional.
2. **Run `flutter pub run build_runner build --delete-conflicting-outputs`** after creating all Freezed models.
3. **Use `const` constructors** everywhere possible for performance.
4. **Avoid `setState`** — use Riverpod providers for all state.
5. **Currency formatting**: always use `NumberFormat('#,##0.000', 'en_US')` for OMR amounts.
6. **Date formatting**: use `DateFormat('dd-MM-yyyy')` for display, `yyyy-MM-dd` for API calls.
7. **The app must work on both Android and iOS.**
8. **Dark mode**: optional — implement light theme only for now.
9. **API base URL**: make it configurable in `api_constants.dart` with a comment explaining how to change it for local development vs production.
10. **The `erp_mobile` folder must be at the root of the current working directory** (same level as the `erp/` web project folder).
