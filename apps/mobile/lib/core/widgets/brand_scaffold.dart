import 'package:flutter/material.dart';

import '../theme.dart';

/// Simple on-brand scaffold used by placeholder feature screens.
///
/// Shows the bolt mark, a heavy Anton title, and an optional subtitle. Feature
/// agents replace the [body] with real content.
class BrandScaffold extends StatelessWidget {
  const BrandScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.body,
    this.actions,
  });

  final String title;
  final String? subtitle;
  final Widget? body;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(title.toUpperCase()),
        actions: actions,
      ),
      body: body ??
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Placeholder bolt mark — real logo not yet provided by the
                  // owner (see docs/owner-content.md).
                  const Icon(
                    Icons.bolt_rounded,
                    size: 72,
                    color: AppColors.voltYellow,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    title.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: textTheme.headlineMedium,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      subtitle!,
                      textAlign: TextAlign.center,
                      style: textTheme.bodyMedium?.copyWith(
                        color: AppColors.mutedText,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
    );
  }
}
