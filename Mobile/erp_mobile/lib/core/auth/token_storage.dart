import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wrapper around [FlutterSecureStorage] for JWT token management.
class TokenStorage {
  TokenStorage._();

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _keyAccess  = 'access_token';
  static const _keyRefresh = 'refresh_token';

  static Future<void> init() async {
    // Nothing extra needed — FlutterSecureStorage initialises lazily.
  }

  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _keyAccess, value: accessToken),
      _storage.write(key: _keyRefresh, value: refreshToken),
    ]);
  }

  static Future<String?> getAccessToken()  => _storage.read(key: _keyAccess);
  static Future<String?> getRefreshToken() => _storage.read(key: _keyRefresh);

  static Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _keyAccess),
      _storage.delete(key: _keyRefresh),
    ]);
  }
}
