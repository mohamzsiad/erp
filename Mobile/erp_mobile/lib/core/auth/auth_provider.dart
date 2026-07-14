import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/app_exception.dart';
import 'auth_state.dart';
import 'models/auth_user.dart';
import 'models/login_response.dart';
import 'models/permission_set.dart';
import 'token_storage.dart';

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    return _bootstrap();
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  Future<AuthState> _bootstrap() async {
    final token = await TokenStorage.getAccessToken();
    if (token == null) return const AuthState.unauthenticated();

    // Check expiry from JWT payload
    if (_isTokenExpired(token)) {
      return _attemptSilentRefresh();
    }

    // Token still valid — fetch user profile
    try {
      final dio = ref.read(apiClientProvider);
      final res = await dio.get(ApiConstants.userProfile);
      final user = AuthUser.fromJson(res.data['user'] as Map<String, dynamic>);
      final perms = (res.data['permissions'] as List<dynamic>)
          .map((e) => PermissionSet.fromJson(e as Map<String, dynamic>))
          .toList();
      return AuthState.authenticated(user: user, permissions: perms);
    } catch (_) {
      return _attemptSilentRefresh();
    }
  }

  Future<AuthState> _attemptSilentRefresh() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) {
      await TokenStorage.clearTokens();
      return const AuthState.unauthenticated();
    }
    try {
      final dio = ref.read(apiClientProvider);
      final res = await dio.post(
        ApiConstants.refresh,
        data: {'refreshToken': refreshToken},
      );
      await TokenStorage.saveTokens(
        accessToken: res.data['accessToken'] as String,
        refreshToken: res.data['refreshToken'] as String? ?? refreshToken,
      );
      return _bootstrap();
    } catch (_) {
      await TokenStorage.clearTokens();
      return const AuthState.unauthenticated();
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final dio = ref.read(apiClientProvider);
      final res = await dio.post(
        ApiConstants.login,
        data: {'email': email, 'password': password},
      );
      final loginResp = LoginResponse.fromJson(res.data as Map<String, dynamic>);
      await TokenStorage.saveTokens(
        accessToken: loginResp.accessToken,
        refreshToken: loginResp.refreshToken,
      );
      return AuthState.authenticated(
        user: loginResp.user,
        permissions: loginResp.permissions,
      );
    });
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    try {
      final refreshToken = await TokenStorage.getRefreshToken();
      final dio = ref.read(apiClientProvider);
      await dio.post(
        ApiConstants.logout,
        data: {'refreshToken': refreshToken},
      );
    } catch (_) {
      // Proceed with local logout even if API call fails
    } finally {
      await TokenStorage.clearTokens();
      state = const AsyncData(AuthState.unauthenticated());
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  bool _isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = utf8.decode(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final data = jsonDecode(payload) as Map<String, dynamic>;
      final exp = data['exp'] as int?;
      if (exp == null) return true;
      return DateTime.now().millisecondsSinceEpoch > exp * 1000;
    } catch (_) {
      return true;
    }
  }

  // ── Permission helper ──────────────────────────────────────────────────────

  bool hasPermission(String module, String resource, String action) {
    final s = state.valueOrNull;
    if (s == null) return false;
    return s.maybeWhen(
      authenticated: (_, perms) => perms.any(
        (p) =>
            p.module.toUpperCase() == module.toUpperCase() &&
            p.resource.toUpperCase() == resource.toUpperCase() &&
            p.action.toUpperCase() == action.toUpperCase(),
      ),
      orElse: () => false,
    );
  }
}

/// Convenience provider to read the authenticated user directly.
final authUserProvider = Provider<AuthUser?>((ref) {
  final auth = ref.watch(authProvider).valueOrNull;
  return auth?.maybeWhen(
    authenticated: (user, _) => user,
    orElse: () => null,
  );
});
