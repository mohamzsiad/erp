import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/auth/token_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Lock orientation to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialise Hive for offline caching
  await Hive.initFlutter();

  // Open required Hive boxes
  await Future.wait([
    Hive.openBox<String>('auth'),
    Hive.openBox<String>('mrl_list'),
    Hive.openBox<String>('prl_list'),
    Hive.openBox<String>('po_list'),
    Hive.openBox<String>('grn_list'),
    Hive.openBox<String>('items_list'),
    Hive.openBox<String>('notifications'),
  ]);

  // Pre-warm token storage
  await TokenStorage.init();

  runApp(
    const ProviderScope(
      child: ErpMobileApp(),
    ),
  );
}
