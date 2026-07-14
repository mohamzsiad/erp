import 'package:flutter/material.dart';

import '../theme/app_colours.dart';
import '../utils/format_utils.dart';

/// Displays an OMR currency amount consistently: "OMR 12,345.678"
class AmountText extends StatelessWidget {
  const AmountText(
    this.amount, {
    super.key,
    this.showCurrency = true,
    this.style,
    this.textAlign,
  });

  final num? amount;
  final bool showCurrency;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    final isNegative = (amount ?? 0) < 0;
    final effectiveStyle = (style ?? Theme.of(context).textTheme.bodyMedium)
        ?.copyWith(color: isNegative ? AppColours.error : null);

    return Text(
      FormatUtils.formatAmount(amount, showCurrency: showCurrency),
      style: effectiveStyle,
      textAlign: textAlign,
    );
  }
}
