import 'package:flutter/material.dart';

import '../theme/app_colours.dart';
import '../utils/format_utils.dart';

/// A KPI summary tile used on the Dashboard.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.title,
    required this.value,
    this.isAmount = false,
    this.accent = AppColours.kpiBlue,
    this.iconData,
    this.iconColor,
    this.onTap,
  });

  final String title;
  final num value;
  final bool isAmount;
  final Color accent;
  final IconData? iconData;
  final Color? iconColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (iconData != null) ...[
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(iconData, size: 18, color: iconColor ?? AppColours.primary),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              isAmount
                  ? FormatUtils.formatAmount(value)
                  : value.toStringAsFixed(0),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColours.textPrimary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
