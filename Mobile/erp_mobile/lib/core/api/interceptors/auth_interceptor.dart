import 'package:dio/dio.dart';

import '../../auth/token_storage.dart';

/// Attaches the Bearer token to every outgoing request.
/// On 401, attempts a silent token refresh and retries the original request once.
class AuthInterceptor extends QueuedInterceptorsWrapper {
  AuthInterceptor({required this.dio});

  final Dio dio;
  bool _isRefreshing = false;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await TokenStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken = await TokenStorage.getRefreshToken();
        if (refreshToken == null) {
          _isRefreshing = false;
          return handler.next(err);
        }

        // Attempt silent refresh
        final refreshResponse = await dio.post(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
          options: Options(headers: {'Authorization': ''}),
        );

        final newAccess = refreshResponse.data['accessToken'] as String?;
        final newRefresh = refreshResponse.data['refreshToken'] as String?;

        if (newAccess != null) {
          await TokenStorage.saveTokens(
            accessToken: newAccess,
            refreshToken: newRefresh ?? refreshToken,
          );

          // Retry original request
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newAccess';
          final retryResponse = await dio.fetch(opts);
          _isRefreshing = false;
          return handler.resolve(retryResponse);
        }
      } catch (_) {
        await TokenStorage.clearTokens();
        // Navigation to login is handled by the router guard watching AuthState
      } finally {
        _isRefreshing = false;
      }
    }
    handler.next(err);
  }
}
