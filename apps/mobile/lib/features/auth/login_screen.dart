import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase_provider.dart';
import '../../core/theme.dart';
import 'auth_widgets.dart';

/// Email/password sign-in backed by Supabase auth.
class LoginScreen extends HookConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final obscurePassword = useState(true);
    final isLoading = useState(false);
    final errorMessage = useState<String?>(null);

    Future<void> signIn() async {
      if (!(formKey.currentState?.validate() ?? false)) return;
      FocusScope.of(context).unfocus();
      isLoading.value = true;
      errorMessage.value = null;
      try {
        await ref.read(supabaseClientProvider).auth.signInWithPassword(
              email: emailController.text.trim(),
              password: passwordController.text,
            );
        // Success: the router redirect takes over (role-based home).
      } on AuthException catch (e) {
        errorMessage.value = e.message;
      } catch (_) {
        errorMessage.value =
            'Could not sign in. Check your connection and try again.';
      } finally {
        if (context.mounted) isLoading.value = false;
      }
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const AuthHeader(
                      subtitle: 'Powering Ohio with Quality You Can Trust.',
                    ),
                    const SizedBox(height: 32),
                    if (errorMessage.value != null) ...[
                      AuthErrorBanner(message: errorMessage.value!),
                      const SizedBox(height: 16),
                    ],
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
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => signIn(),
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
                      validator: (value) => (value == null || value.isEmpty)
                          ? 'Enter your password'
                          : null,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: isLoading.value ? null : signIn,
                      child: isLoading.value
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.black,
                              ),
                            )
                          : const Text('SIGN IN'),
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
                          'New to Pikavolt?',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: AppColors.mutedText),
                        ),
                        TextButton(
                          onPressed: isLoading.value
                              ? null
                              : () => context.go('/signup'),
                          child: const Text('Create account'),
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
