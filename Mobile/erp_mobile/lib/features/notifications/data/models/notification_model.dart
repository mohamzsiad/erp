import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification_model.freezed.dart';
part 'notification_model.g.dart';

@freezed
class ErpNotification with _$ErpNotification {
  const factory ErpNotification({
    required String id,
    String? userId,
    @Default('') String title,
    @Default('') String message,
    @Default('INFO') String type,
    @Default(false) bool isRead,
    String? createdAt,
    String? link,
  }) = _ErpNotification;

  factory ErpNotification.fromJson(Map<String, dynamic> json) =>
      _$ErpNotificationFromJson(json);
}

@freezed
class UnreadCount with _$UnreadCount {
  const factory UnreadCount({
    @Default(0) int count,
  }) = _UnreadCount;

  factory UnreadCount.fromJson(Map<String, dynamic> json) =>
      _$UnreadCountFromJson(json);
}
