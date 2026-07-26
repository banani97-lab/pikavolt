import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_provider.dart';
import '../../core/theme.dart';
import 'auth_widgets.dart';

/// Email/password account creation backed by Supabase auth.
///
/// New accounts get the `customer` role (profiles row is created by a DB
/// trigger in packages/db; `full_name` is passed via auth metadata).
class SignupScreen extends HookConsumerWidget {
  const SignupScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final nameController = useTextEditingController();
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final confirmController = useTextEditingController();
    final obscurePassword = useState(true);
    final isLoading = useState(false);
    final errorMessage = useState<String?>(null);
    final needsEmailConfirmation = useState(false);

    Future<void> signUp() async {
      if (!(formKey.currentState?.validate() ?? false)) return;
      FocusScope.of(context).unfocus();
      isLoading.value = true;
      errorMessage.value = null;
      try {
        final response = await ref.read(supabaseClientProvider).auth.signUp(
          email: emailController.text.trim(),
          password: passwordController.text,
          data: {'full_name': nameController.text.trim()},
        );
        // If email confirmation is enabled there is no session yet.
        if (response.session == null) {
          needsEmailConfirmation.value = true;
        }
        // Otherwise the router redirect takes over.
      } on AuthException catch (e) {
        errorMessage.value = e.message;
      } catch (_) {
        errorMessage.value =
            'Could not create your account. Check your connection and try '
            'again.';
      } finally {
        if (context.mounted) isLoading.value = false;
      }
    }

    if (needsEmailConfirmation.value) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.mark_email_read_outlined,
                    size: 64,
                    color: AppColors.voltYellow,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'CHECK YOUR EMAIL',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'We sent a confirmation link to '
                    '${emailController.text.trim()}. '
                    'Confirm it, then sign in.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: AppColors.mutedText),
                  ),
                  const SizedBox(height: 24),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('Back to sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/login')),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const AuthHeader(subtitle: 'Create your account.'),
                    const SizedBox(height: 24),
                    if (errorMessage.value != null) ...[
                      AuthErrorBanner(message: errorMessage.value!),
                      const SizedBox(height: 16),
                    ],
                    TextFormField(
                      controller: nameController,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Full name',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty)
                              ? 'Enter your name'
                              : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: (value) {
                        final v = value?.trim() ?? '';
                        if (v.isEmpty) return 'Enter your email';
                        if (!v.contains('@') || !v.contains('.')) {
                          return 'Enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: passwordController,
                      obscureText: obscurePassword.value,
                      autofillHints: const [AutofillHints.newPassword],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          icon: Icon(
                            obscurePassword.value
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () =>
                              obscurePassword.value = !obscurePassword.value,
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Enter a password';
                        }
                        if (value.length < 8) {
                          return 'Use at least 8 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: confirmController,
                      obscureText: obscurePassword.value,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => signUp(),
                      decoration: const InputDecoration(
                        labelText: 'Confirm password',
                        prefixIcon: Icon(Icons.lock_outline),
                      ),
                      validator: (value) => value != passwordController.text
                          ? 'Passwords do not match'
                          : null,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: isLoading.value ? null : signUp,
                      child: isLoading.value
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.black,
                              ),
                            )
                          : const Text('CREATE ACCOUNT'),
                    ),
                    // Google sign-in intentionally omitted for v1: offering a
                    // third-party social login would trigger App Store
                    // Guideline 4.8 (must also add Sign in with Apple). Ship
                    // email/password only; re-enable GoogleSignInButton here
                    // alongside Apple in a later update.
                    const SizedBox(height: 24),
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'Already have an account?',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: AppColors.mutedText),
                        ),
                        TextButton(
                          onPressed: isLoading.value
                              ? null
                              : () => context.go('/login'),
                          child: const Text('Sign in'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
