# erp_mobile — Setup Guide

## Prerequisites
- Flutter SDK ≥ 3.3.0  
- Dart SDK ≥ 3.3.0  
- Android Studio / Xcode installed

## 1. Install dependencies
```bash
cd erp_mobile
flutter pub get
```

## 2. Generate Freezed + JSON serialization code
```bash
flutter pub run build_runner build --delete-conflicting-outputs
```
> Re-run this whenever you add or change a `@freezed` or `@JsonSerializable` model.

## 3. Configure the API base URL
Edit `lib/core/api/api_constants.dart`:
| Environment          | baseUrl value                            |
|----------------------|------------------------------------------|
| Android emulator     | `http://10.0.2.2:3000/api/v1`            |
| iOS simulator        | `http://127.0.0.1:3000/api/v1`           |
| Physical device (Wi-Fi) | `http://192.168.x.x:3000/api/v1`     |
| Production           | `https://erp.alwadi.com/api/v1`          |

## 4. Run on Android
```bash
flutter run -d android
```

## 5. Run on iOS
```bash
cd ios && pod install && cd ..
flutter run -d ios
```

## App Icons
Place your icon assets in `assets/icons/app_icon.png` (1024×1024), then run:
```bash
flutter pub run flutter_launcher_icons
```

## Architecture Overview
```
lib/
├── main.dart           # Entry point — Hive init, ProviderScope
├── app.dart            # MaterialApp.router
├── core/               # Shared: API client, auth, theme, router, widgets, utils
└── features/           # Feature modules (Clean Architecture)
    ├── dashboard/
    ├── approvals/
    ├── procurement/  (mrl/ prl/ po/)
    ├── inventory/    (items/ grn/ issue/ stock/)
    ├── finance/      (ap/ ar/ journals/ budgets/)
    ├── notifications/
    ├── ai_chat/
    └── profile/
```
Each feature: `data/models/` → `data/repositories/` → `providers/` → `ui/screens/`
