import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_colours.dart';

/// 5-tab bottom navigation shell for the app.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.child});

  final Widget child;

  static const _tabs = [
    _Tab(icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: 'Dashboard', path: '/dashboard'),
    _Tab(icon: Icons.shopping_cart_outlined, activeIcon: Icons.shopping_cart, label: 'Procurement', path: '/procurement/prl'),
    _Tab(icon: Icons.inventory_2_outlined, activeIcon: Icons.inventory_2, label: 'Inventory', path: '/inventory/items'),
    _Tab(icon: Icons.account_balance_wallet_outlined, activeIcon: Icons.account_balance_wallet, label: 'Finance', path: '/finance/ap/invoices'),
    _Tab(icon: Icons.menu, activeIcon: Icons.menu, label: 'More', path: null),
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _resolveIndex(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (i) => _onTap(context, i),
        items: _tabs
            .map((t) => BottomNavigationBarItem(
                  icon: Icon(t.icon),
                  activeIcon: Icon(t.activeIcon),
                  label: t.label,
                ))
            .toList(),
      ),
    );
  }

  int _resolveIndex(String location) {
    if (location.startsWith('/procurement')) return 1;
    if (location.startsWith('/inventory')) return 2;
    if (location.startsWith('/finance')) return 3;
    if (location == '/approvals' ||
        location == '/notifications' ||
        location == '/ai-chat' ||
        location == '/profile') return 4;
    return 0; // dashboard
  }

  void _onTap(BuildContext context, int index) {
    if (index == 4) {
      _showMoreDrawer(context);
      return;
    }
    final path = _tabs[index].path;
    if (path != null) context.go(path);
  }

  void _showMoreDrawer(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _MoreSheet(),
    );
  }
}

class _Tab {
  const _Tab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
  });
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String? path;
}

class _MoreSheet extends StatelessWidget {
  const _MoreSheet();

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.check_circle_outline, 'Approvals', '/approvals'),
      (Icons.chat_bubble_outline, 'AI Assistant', '/ai-chat'),
      (Icons.notifications_outlined, 'Notifications', '/notifications'),
      (Icons.person_outline, 'Profile', '/profile'),
    ];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColours.cardBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ...items.map(
              (item) => ListTile(
                leading: Icon(item.$1, color: AppColours.primary),
                title: Text(item.$2),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(context);
                  context.go(item.$3);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
