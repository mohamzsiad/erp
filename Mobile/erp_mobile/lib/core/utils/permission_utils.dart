import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';

/// Helper to check permissions from anywhere in the widget tree.
class PermissionUtils {
  PermissionUtils._();

  static bool check(WidgetRef ref, String module, String resource, String action) {
    return ref.read(authProvider.notifier).hasPermission(module, resource, action);
  }
}
