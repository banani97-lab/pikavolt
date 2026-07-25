import 'package:flutter/material.dart';

import '../theme.dart';

/// Asset paths for the delivered mascot art (see docs/brand.md).
abstract final class MascotAssets {
  static const String full = 'assets/images/mascot.png';
  static const String face = 'assets/images/mascot-face.png';
}

/// The full mascot illustration at a given height.
class Mascot extends StatelessWidget {
  const Mascot({super.key, this.height = 140});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      MascotAssets.full,
      height: height,
      fit: BoxFit.contain,
      // Tests / builds without the asset still render.
      errorBuilder: (_, _, _) => Icon(
        Icons.bolt_rounded,
        size: height * 0.6,
        color: AppColors.voltYellow,
      ),
    );
  }
}

/// Round mascot face — used as the owner avatar in chat and small brand marks.
class MascotFace extends StatelessWidget {
  const MascotFace({super.key, this.size = 40, this.voltRing = false});

  final double size;

  /// Draw the volt-yellow ring (chat-button treatment from docs/brand.md).
  final bool voltRing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.teal,
        border: voltRing
            ? Border.all(color: AppColors.voltYellow, width: 2)
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        MascotAssets.face,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const Icon(
          Icons.bolt_rounded,
          color: AppColors.voltYellow,
        ),
      ),
    );
  }
}
