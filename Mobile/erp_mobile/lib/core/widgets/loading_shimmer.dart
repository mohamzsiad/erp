import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../theme/app_colours.dart';

/// Skeleton loader — 5 shimmer tiles matching DocumentListTile height.
class LoadingShimmer extends StatelessWidget {
  const LoadingShimmer({super.key, this.itemCount = 5});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColours.cardBorder,
      highlightColor: AppColours.surface,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, __) => Container(
          height: 82,
          decoration: BoxDecoration(
            color: AppColours.surface,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

/// Single shimmer block for arbitrary placeholders.
class ShimmerBlock extends StatelessWidget {
  const ShimmerBlock({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
  });

  final double width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColours.cardBorder,
      highlightColor: AppColours.surface,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}
