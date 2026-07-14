import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/notification_model.dart';
import '../data/repositories/notifications_repository.dart';

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) {
  return ref.watch(notificationsRepositoryProvider).fetchUnreadCount();
});

final notificationsUnreadOnlyProvider = StateProvider<bool>((ref) => false);

class NotificationsNotifier extends AsyncNotifier<List<ErpNotification>> {
  int _page = 1;
  bool _hasMore = true;
  final List<ErpNotification> _items = [];

  @override
  Future<List<ErpNotification>> build() async {
    _page = 1;
    _hasMore = true;
    _items.clear();
    final unreadOnly = ref.watch(notificationsUnreadOnlyProvider);
    final res = await ref
        .read(notificationsRepositoryProvider)
        .fetchList(page: _page, unreadOnly: unreadOnly);
    _items.addAll(res.data);
    _hasMore = _items.length < res.total;
    return List.from(_items);
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;
    _page++;
    final unreadOnly = ref.read(notificationsUnreadOnlyProvider);
    final res = await ref
        .read(notificationsRepositoryProvider)
        .fetchList(page: _page, unreadOnly: unreadOnly);
    _items.addAll(res.data);
    _hasMore = _items.length < res.total;
    state = AsyncData(List.from(_items));
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationsRepositoryProvider).markRead(id);
    final idx = _items.indexWhere((n) => n.id == id);
    if (idx != -1) {
      _items[idx] = _items[idx].copyWith(isRead: true);
      state = AsyncData(List.from(_items));
    }
  }

  Future<void> markAllRead() async {
    await ref.read(notificationsRepositoryProvider).markAllRead();
    for (var i = 0; i < _items.length; i++) {
      _items[i] = _items[i].copyWith(isRead: true);
    }
    state = AsyncData(List.from(_items));
    ref.invalidate(unreadCountProvider);
  }
}

final notificationsNotifierProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<ErpNotification>>(
        NotificationsNotifier.new);
