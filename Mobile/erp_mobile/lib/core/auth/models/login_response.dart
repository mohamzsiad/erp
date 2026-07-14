import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_user.dart';
import 'permission_set.dart';

part 'login_response.freezed.dart';
part 'login_response.g.dart';

@freezed
class LoginResponse with _$LoginResponse {
  const factory LoginResponse({
    required String accessToken,
    required String refreshToken,
    required AuthUser user,
    required List<PermissionSet> permissions,
  }) = _LoginResponse;

  factory LoginResponse.fromJson(Map<String, dynamic> json) =>
      _$LoginResponseFromJson(json);
}
