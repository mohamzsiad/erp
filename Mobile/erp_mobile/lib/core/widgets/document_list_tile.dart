import 'package:flutter/material.dart';

import '../theme/app_colours.dart';
import '../utils/format_utils.dart';
import 'amount_text.dart';
import 'status_badge.dart';

/// Standardised list tile for all document types (MRL, PRL, PO, GRN, etc.)
class DocumentListTile extends StatelessWidget {
  const DocumentListTile({
    super.key,
    required this.docNo,
    required this.status,
    required this.subtitle,
    required this.date,
    this.amount,
    this.docType,
    this.onTap,
  });

  final String docNo;
  final String status;
  final String subtitle;
  final String date;
  final num? amount;
  final String? docType;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Row(
          children: [
            // Doc type icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _iconBg(docType),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  _iconLabel(docType),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColours.surface,
                  ),
                ),
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
                          docNo,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                      ),
                      StatusBadge(status: status),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        date,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: AppColours.textHint),
                      ),
                      if (amount != null)
                        AmountText(
                          amount,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w600,
                                color: AppColours.textPrimary,
                              ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: AppColours.textHint, size: 20),
          ],
        ),
      ),
    );
  }

  Color _iconBg(String? type) => switch (type?.toUpperCase()) {
        'MRL' => const Color(0xFF7C3AED),
        'PRL' => AppColours.primary,
        'PO'  => const Color(0xFF0369A1),
        'GRN' => const Color(0xFF065F46),
        'AP'  => const Color(0xFFB45309),
        'AR'  => const Color(0xFF047857),
        'JNL' => const Color(0xFF6D28D9),
        _     => AppColours.primaryLight,
      };

  String _iconLabel(String? type) => switch (type?.toUpperCase()) {
        'MRL' => 'MRL',
        'PRL' => 'PRL',
        'PO'  => 'PO',
        'GRN' => 'GRN',
        'AP'  => 'AP',
        'AR'  => 'AR',
        'JNL' => 'JNL',
        _     => type?.substring(0, type.length.clamp(0, 3)).toUpperCase() ?? '?',
      };
}
