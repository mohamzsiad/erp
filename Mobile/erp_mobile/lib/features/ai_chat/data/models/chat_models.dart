import 'package:freezed_annotation/freezed_annotation.dart';

part 'chat_models.freezed.dart';
part 'chat_models.g.dart';

enum ChatRole { user, assistant }

@freezed
class ChatMessage with _$ChatMessage {
  const factory ChatMessage({
    required String id,
    required ChatRole role,
    required String content,
    DateTime? timestamp,
    List<Map<String, dynamic>>? data,
    String? chartHint,
  }) = _ChatMessage;

  factory ChatMessage.fromJson(Map<String, dynamic> json) =>
      _$ChatMessageFromJson(json);
}

@freezed
class ChatResponse with _$ChatResponse {
  const factory ChatResponse({
    required String answer,
    List<Map<String, dynamic>>? data,
    String? chartHint,
  }) = _ChatResponse;

  factory ChatResponse.fromJson(Map<String, dynamic> json) =>
      _$ChatResponseFromJson(json);
}

@freezed
class ChatHistoryItem with _$ChatHistoryItem {
  const factory ChatHistoryItem({
    required String role,
    required String content,
  }) = _ChatHistoryItem;

  factory ChatHistoryItem.fromJson(Map<String, dynamic> json) =>
      _$ChatHistoryItemFromJson(json);

  Map<String, dynamic> toJson() => _$ChatHistoryItemToJson(this);
}
