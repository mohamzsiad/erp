import 'package:freezed_annotation/freezed_annotation.dart';

part 'permission_set.freezed.dart';
part 'permission_set.g.dart';

@freezed
class PermissionSet with _$PermissionSet {
  const factory PermissionSet({
    required String module,
    required String resource,
    required String action,
  }) = _PermissionSet;

  factory PermissionSet.fromJson(Map<String, dynamic> json) =>
      _$PermissionSetFromJson(json);
}
