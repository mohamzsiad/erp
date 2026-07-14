import 'package:flutter/material.dart';

import '../theme/app_colours.dart';

/// Standardised AppBar used across all screens.
class ErpAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ErpAppBar({
    super.key,
    required this.title,
    this.actions,
    this.bottom,
    this.showBack = true,
  });

  final String title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final bool showBack;

  @override
  Size get preferredSize => Size.fromHeight(
        kToolbarHeight + (bottom?.preferredSize.height ?? 0),
      );

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      automaticallyImplyLeading: showBack,
      actions: actions,
      bottom: bottom,
      elevation: 0,
      backgroundColor: AppColours.primary,
      foregroundColor: AppColours.surface,
    );
  }
}
