import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Anton-styled brand header used on the auth screens.
class AuthHeader extends StatelessWidget {
  const AuthHeader({super.key, required this.subtitle});

  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.bolt_rounded, size: 56, color: AppColors.voltYellow),
        const SizedBox(height: 12),
        Text('PIKAVOLT', style: textTheme.displaySmall),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: textTheme.bodyMedium?.copyWith(color: AppColors.mutedText),
        ),
      ],
    );
  }
}

/// Inline error banner for auth failures.
class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Continue with Google" button — STUB.
///
/// TODO(auth-agent): wire native Google sign-in (google_sign_in package +
/// supabase.auth.signInWithIdToken) once OAuth client IDs exist.
class GoogleSignInButton extends StatelessWidget {
  const GoogleSignInButton({super.key});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      icon: const Icon(Icons.g_mobiledata_rounded, size: 28),
      label: const Text('Continue with Google'),
      onPressed: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Google sign-in is coming soon.'),
          ),
        );
      },
    );
  }
}
