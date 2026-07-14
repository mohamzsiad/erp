/// Typed exception used throughout the app for API errors.
class AppException implements Exception {
  const AppException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  bool get isNetworkError => statusCode == null;
  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isServerError => statusCode != null && statusCode! >= 500;

  @override
  String toString() => 'AppException($statusCode): $message';
}
