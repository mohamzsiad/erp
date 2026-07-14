import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colours.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/loading_shimmer.dart';
import '../../data/models/notification_model.dart';
import '../../providers/notifications_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unreadOnly = ref.watch(notificationsUnreadOnlyProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          TextButton.icon(
            onPressed: () => ref
                .read(notificationsNotifierProvider.notifier)
                .markAllRead(),
            icon: const Icon(Icons.done_all, color: AppColours.surface, size: 18),
            label: const Text('All read',
                style: TextStyle(color: AppColours.surface, fontSize: 12)),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Row(
            children: [
              const SizedBox(width: 16),
              _TabChip(
                label: 'All',
                selected: !unreadOnly,
                onTap: () => ref
                    .read(notificationsUnreadOnlyProvider.notifier)
                    .state = false,
              ),
              const SizedBox(width: 8),
              _TabChip(
                label: 'Unread',
                selected: unreadOnly,
                onTap: () => ref
                    .read(notificationsUnreadOnlyProvider.notifier)
                    .state = true,
              ),
              const SizedBox(width: 16),
            ],
          ),
        ),
      ),
      body: Consumer(
        builder: (ctx, ref, _) {
          final async = ref.watch(notificationsNotifierProvider);
          return RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(notificationsNotifierProvider),
            child: async.when(
              loading: () => const LoadingShimmer(),
              error: (e, _) => ErrorState(
                message: e.toString(),
                onRetry: () =>
                    ref.invalidate(notificationsNotifierProvider),
              ),
              data: (items) => items.isEmpty
                  ? const EmptyState(
                      message: 'No notifications yet.',
                      icon: Icons.notifications_none_outlined,
                    )
                  : NotificationListener<ScrollNotification>(
                      onNotification: (n) {
                        if (n.metrics.pixels >=
                            n.metrics.maxScrollExtent - 200) {
                          ref
                              .read(notificationsNotifierProvider.notifier)
                              .loadMore();
                        }
                        return false;
                      },
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 6),
                        itemBuilder: (ctx, i) =>
                            _NotificationTile(notification: items[i]),
                      ),
                    ),
            ),
          );
        },
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip(
      {required this.label,
      required this.selected,
      required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? AppColours.surface : AppColours.primary.withOpacity(0.3),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? AppColours.primary : AppColours.surface,
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});
  final ErpNotification notification;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isUnread = !notification.isRead;

    return GestureDetector(
      onTap: () async {
        if (isUnread) {
          await ref
              .read(notificationsNotifierProvider.notifier)
              .markRead(notification.id);
        }
        if (notification.link != null && context.mounted) {
          context.go(notification.link!);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUnread
              ? AppColours.primary.withOpacity(0.05)
              : AppColours.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isUnread
                ? AppColours.primary.withOpacity(0.2)
                : AppColours.cardBorder,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type icon
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: _iconColor(notification.type).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _iconData(notification.type),
                size: 18,
                color: _iconColor(notification.type),
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: isUnread
                                        ? FontWeight.bold
                                        : FontWeight.w500,
                                  ),
                        ),
                      ),
                      if (isUnread)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColours.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.message,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.createdAt != null
                        ? FormatUtils.timeAgo(
                            DateTime.tryParse(notification.createdAt!) ??
                                DateTime.now())
                        : '',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColours.textHint,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconData(String type) => switch (type.toUpperCase()) {
        'APPROVAL'  => Icons.check_circle_outline,
        'REJECTION' => Icons.cancel_outlined,
        'ALERT'     => Icons.warning_amber_outlined,
        'INFO'      => Icons.info_outline,
        'SUCCESS'   => Icons.task_alt_outlined,
        _           => Icons.notifications_outlined,
      };

  Color _iconColor(String type) => switch (type.toUpperCase()) {
        'APPROVAL'  => AppColours.statusApproved,
        'REJECTION' => AppColours.statusRejected,
        'ALERT'     => AppColours.statusPartial,
        'INFO'      => AppColours.statusSubmitted,
        'SUCCESS'   => AppColours.statusApproved,
        _           => AppColours.primary,
      };
}
