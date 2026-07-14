import 'package:freezed_annotation/freezed_annotation.dart';

import 'models/auth_user.dart';
import 'models/permission_set.dart';

part 'auth_state.freezed.dart';

@freezed
class AuthState with _$AuthState {
  const factory AuthState.unauthenticated() = _Unauthenticated;
  const factory AuthState.loading()         = _Loading;
  const factory AuthState.authenticated({
    required AuthUser user,
    required List<PermissionSet> permissions,
  }) = _Authenticated;
}
