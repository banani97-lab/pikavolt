/// Stripe PaymentSheet wrapper.
///
/// The publishable key is resolved at runtime: the server's `/api/config`
/// value wins (so a Stripe test↔live switch can be flipped server-side without
/// a new app build), falling back to the compile-time
/// `--dart-define=STRIPE_PUBLISHABLE_KEY=...` (see core/env.dart) when the
/// server is unreachable or unconfigured. When neither yields a valid key,
/// [PaymentsService.isEnabled] is false and callers show a friendly "payments
/// unavailable" state instead of the sheet.
library;

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/env.dart';

/// Outcome of a PaymentSheet presentation.
enum PaymentSheetResult { success, cancelled, failed }

class PaymentsService {
  const PaymentsService();

  /// The currently-resolved publishable key. Seeded from the compile-time key
  /// so payments work offline / before the first server refresh; overridden by
  /// [init] once the server key is fetched.
  static String? _publishableKey =
      Env.stripeEnabled ? Env.stripePublishableKey : null;

  static bool _isValidKey(String? key) =>
      key != null && key.startsWith('pk_') && !key.contains('placeholder');

  /// Whether a usable Stripe publishable key is currently configured.
  static bool get isEnabled => _isValidKey(_publishableKey);

  /// Configures Stripe with the best available publishable key.
  ///
  /// Prefers [serverPublishableKey] (from `/api/config`) so test↔live can be
  /// flipped server-side; falls back to the compile-time key. Safe no-op when
  /// no valid key is available. Idempotent — call again to apply a new key.
  Future<void> init({String? serverPublishableKey}) async {
    final resolved = _isValidKey(serverPublishableKey)
        ? serverPublishableKey
        : (Env.stripeEnabled ? Env.stripePublishableKey : null);
    _publishableKey = resolved;

    if (resolved == null) {
      debugPrint(
        'PaymentsService: no Stripe key (server or build) — payments disabled.',
      );
      return;
    }
    try {
      Stripe.publishableKey = resolved;
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
