import 'package:dio/dio.dart';

import '../../models/app_exception.dart';

/// Maps Dio exceptions into typed [AppException]s.
class ErrorInterceptor extends InterceptorsWrapper {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final statusCode = err.response?.statusCode;
    final data = err.response?.data;

    String message;

    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.sendTimeout) {
      message = 'Connection timed out. Please try again.';
    } else if (err.type == DioExceptionType.connectionError) {
      message = 'No internet connection. Showing cached data.';
    } else {
      switch (statusCode) {
        case 400:
          message = _extractMessage(data) ?? 'Invalid request.';
          break;
        case 401:
          message = 'Session expired. Please sign in again.';
          break;
        case 403:
          message = "You don't have permission for this action.";
          break;
        case 404:
          message = 'Resource not found.';
          break;
        case 409:
          message = _extractMessage(data) ?? 'Conflict error.';
          break;
        case 422:
          message = _extractMessage(data) ?? 'Validation error.';
          break;
        case 500:
        case 502:
        case 503:
          message = 'Server error. Please try again.';
          break;
        default:
          message = _extractMessage(data) ?? 'An unexpected error occurred.';
      }
    }

    handler.next(
      DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: err.type,
        error: AppException(message, statusCode),
        message: message,
      ),
    );
  }

  String? _extractMessage(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data['message'] as String? ?? data['error'] as String?;
    }
    return null;
  }
}
