# CloudERP Mobile — Developer Setup

**App:** CloudERP for Al Wadi Construction LLC (Muscat, Oman)  
**Stack:** Flutter 3.x · Riverpod · GoRouter · Freezed · Dio · fl_chart · reactive_forms

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Flutter | 3.19+ |
| Dart SDK | 3.3.0+ |
| Android Studio / Xcode | latest stable |

---

## 1 — First-time setup

```bash
cd erp_mobile

# Install dependencies
flutter pub get

# Generate all Freezed + JSON serialisation code  (must run after any model change)
dart run build_runner build --delete-conflicting-outputs
```

---

## 2 — Configure the API base URL

Open **`lib/core/api/api_constants.dart`** and set `baseUrl` for your environment:

| Environment | Value |
|---|---|
| Android emulator | `http://10.0.2.2:3000/api/v1` *(default)* |
| iOS simulator | `http://127.0.0.1:3000/api/v1` |
| Physical device (same Wi-Fi) | `http://<your-LAN-IP>:3000/api/v1` |
| Production | `https://erp.alwadi.com/api/v1` |

---

## 3 — Run the app

```bash
# Android emulator
flutter run -d emulator-5554

# iOS simulator
flutter run -d "iPhone 15"

# List available devices
flutter devices
```

---

## 4 — Regenerate code after model changes

Any time you edit a file that contains `@freezed`, run:

```bash
dart run build_runner build --delete-conflicting-outputs
```

For watch mode during active development:

```bash
dart run build_runner watch --delete-conflicting-outputs
```

### Files that require code generation (20 total)

```
core/auth/auth_state.dart
core/auth/models/auth_user.dart
core/auth/models/login_response.dart
core/auth/models/permission_set.dart
features/ai_chat/data/models/chat_models.dart
features/approvals/data/models/approval_models.dart
features/dashboard/data/models/kpi_data.dart
features/finance/ap_invoices/data/models/ap_invoice_models.dart
features/finance/ap_payments/data/models/ap_payment_models.dart
features/finance/ar_invoices/data/models/ar_invoice_models.dart
features/finance/budget/data/models/budget_models.dart
features/finance/journal_entries/data/models/journal_entry_models.dart
features/inventory/grn/data/models/grn_models.dart
features/inventory/items/data/models/item_models.dart
features/inventory/stock_issue/data/models/stock_issue_models.dart
features/inventory/stock_summary/data/models/stock_summary_models.dart
features/notifications/data/models/notification_model.dart
features/procurement/mrl/data/models/mrl_models.dart
features/procurement/po/data/models/po_models.dart
features/procurement/prl/data/models/prl_models.dart
```

Each generates a `.freezed.dart` and a `.g.dart` sibling file (except `auth_state.dart` which is a pure union and only generates `.freezed.dart`).

---

## 5 — Project structure (133 source files)

```
lib/
├── core/
│   ├── api/          api_client.dart · api_constants.dart
│   ├── auth/         auth_provider · auth_state · models/
│   ├── models/       app_exception · paginated_response
│   ├── router/       app_router · route_names
│   ├── theme/        app_colours · app_theme · text_styles
│   ├── utils/        format_utils · date_utils
│   └── widgets/      amount_text · empty_state · error_state ·
│                     kpi_card · loading_shimmer · status_badge ·
│                     bottom_nav · app_drawer
│
└── features/
    ├── auth/                 login screen
    ├── dashboard/            KPIs · workflow task list
    ├── approvals/            my-tasks list · approve/reject dialog
    ├── notifications/        notification list · unread badge
    ├── profile/              user profile · logout
    ├── ai_chat/              AI assistant chat screen
    ├── procurement/
    │   ├── mrl/              Material Request Letter (list · detail · create)
    │   ├── prl/              Purchase Request Letter (list · detail · create)
    │   └── po/               Purchase Order (list · detail · create)
    ├── inventory/
    │   ├── items/            Item master (list · detail)
    │   ├── grn/              Goods Receipt Note (list · detail · create)
    │   ├── stock_issue/      Stock Issue (list · detail · create)
    │   └── stock_summary/    Stock summary with low-stock filter
    └── finance/
        ├── ap_invoices/      AP Invoice (list · detail · approve/post/cancel)
        ├── ap_payments/      AP Payment (list · detail · allocations)
        ├── ar_invoices/      AR Invoice (list · detail · approve/post/cancel)
        ├── journal_entries/  Journal Entry (list · detail · double-entry table)
        └── budget/           Budget vs Actual (chart · category drill-down)
```

---

## 6 — Currency & formatting

All monetary values use OMR (Omani Rial, 3 decimal places).  
Widget: `AmountText(value)` — renders `"OMR 12,345.678"`, negative amounts in red.  
Utility: `FormatUtils.formatAmount(num?, {bool showCurrency})`.

---

## 7 — Notes

- **Secure storage:** JWT tokens are stored in `flutter_secure_storage`. On Android emulator, keystore must be initialised (run the app at least once).
- **Build runner output:** commit the generated `.freezed.dart` and `.g.dart` files so CI does not need to regenerate them on every build, or add a `dart run build_runner build` step to your CI pipeline.
- **Stale scaffold folders** (`finance/ap/`, `finance/ar/`, `finance/budgets/`, `finance/journals/`, `inventory/issue/`, `inventory/stock/`, `inventory/items/providers/`) contain single-line placeholder files (`// Superseded — see the corresponding feature module.`). They are harmless and can be deleted manually if desired.
