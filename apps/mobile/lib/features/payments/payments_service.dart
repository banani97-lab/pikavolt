/// Stripe PaymentSheet wrapper.
///
/// The publishable key arrives via `--dart-define=STRIPE_PUBLISHABLE_KEY=...`
/// (see core/env.dart). When absent or a placeholder, [PaymentsService
/// .isEnabled] is false and callers show a friendly "payments unavailable in
/// this build" state instead of the sheet.
library;

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/env.dart';

/// Outcome of a PaymentSheet presentation.
enum PaymentSheetResult { success, cancelled, failed }

class PaymentsService {
  const PaymentsService();

  /// Whether a real Stripe publishable key was supplied at build time.
  static bool get isEnabled => Env.stripeEnabled;

  /// Sets the publishable key. Safe no-op when no key is configured.
  Future<void> init() async {
    if (!isEnabled) {
      debugPrint(
        'PaymentsService: no STRIPE_PUBLISHABLE_KEY — payments disabled '
        'in this build.',
      );
      return;
    }
    try {
      Stripe.publishableKey = Env.stripePublishableKey;
      await Stripe.instance.applySettings();
    } catch (e) {
      debugPrint('PaymentsService: Stripe init failed: $e');
    }
  }

  /// Initializes and presents the PaymentSheet for [clientSecret].
  Future<PaymentSheetResult> presentPaymentSheet({
    required String clientSecret,
  }) async {
    if (!isEnabled) return PaymentSheetResult.failed;
    try {
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Pikavolt LLC',
          style: ThemeMode.dark,
          appearance: const PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              background: Color(0xFF0E2A33),
              primary: Color(0xFFFFE600),
              componentBackground: Color(0xFF081A21),
              componentText: Color(0xFFF8FAFC),
              primaryText: Color(0xFFF8FAFC),
              secondaryText: Color(0xFF9FB8C2),
              placeholderText: Color(0xFF9FB8C2),
            ),
          ),
        ),
      );
      await Stripe.instance.presentPaymentSheet();
      return PaymentSheetResult.success;
    } on StripeException catch (e) {
      if (e.error.code == FailureCode.Canceled) {
        return PaymentSheetResult.cancelled;
      }
      debugPrint('PaymentsService: sheet failed: ${e.error.message}');
      return PaymentSheetResult.failed;
    } catch (e) {
      debugPrint('PaymentsService: sheet failed: $e');
      return PaymentSheetResult.failed;
    }
  }
}

final paymentsServiceProvider =
    Provider<PaymentsService>((ref) => const PaymentsService());
