import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_constants.dart';
import '../../../../core/models/app_exception.dart';
import '../models/chat_models.dart';

final aiChatRepositoryProvider = Provider<AiChatRepository>((ref) {
  return AiChatRepository(ref.read(apiClientProvider));
});

class AiChatRepository {
  AiChatRepository(this._dio);
  final Dio _dio;

  Future<ChatResponse> sendMessage({
    required String message,
    required List<ChatHistoryItem> history,
  }) async {
    try {
      final res = await _dio.post(ApiConstants.aiChat, data: {
        'message': message,
        'history': history.map((e) => e.toJson()).toList(),
      });
      return ChatResponse.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw e.error is AppException
          ? e.error! as AppException
          : AppException(e.message ?? 'Unknown error');
    }
  }
}
