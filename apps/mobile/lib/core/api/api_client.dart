/// HTTP client for the Next.js web API (WS-B) — /api/slots and
/// /api/payments/*.
///
/// Authenticates by attaching the current Supabase access token as
/// `Authorization: Bearer <jwt>`. The web endpoints accept the Supabase
/// session either as a cookie (browser) or as a bearer token (this app).
///
/// INTEGRATION TODO(WS-B): if bearer-token auth is not wired server-side yet,
/// these calls will 401 — the header contract here is final, wire the server
/// to accept it.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../env.dart';
import '../models/api_models.dart';
import '../supabase_provider.dart';

class ApiException implements Exception {
  const ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  /// Endpoint exists but is not implemented yet (WS-B stub).
  bool get isNotImplemented => statusCode == 501 || statusCode == 404;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.accessToken,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  final String baseUrl;

  /// Returns the current Supabase access token, or null when signed out.
  final String? Function() accessToken;
  final http.Client _http;

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (accessToken() != null)
          'Authorization': 'Bearer ${accessToken()}',
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Map<String, dynamic> _decode(http.Response res) {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      String message = res.body;
      try {
        final body = jsonDecode(res.body);
        if (body is Map<String, dynamic>) {
          message = (body['error'] ?? body['message'] ?? res.body).toString();
        }
      } catch (_) {/* keep raw body */}
      throw ApiException(res.statusCode, message);
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// GET /api/slots?date=YYYY-MM-DD
  Future<SlotsResponse> getSlots(String date) async {
    final res =
        await _http.get(_uri('/api/slots', {'date': date}), headers: _headers());
    return SlotsResponse.fromJson(_decode(res));
  }

  /// POST /api/payments/validate-promo
  Future<ValidatePromoResponse> validatePromo(String code) async {
    final res = await _http.post(
      _uri('/api/payments/validate-promo'),
      headers: _headers(),
      body: jsonEncode({'code': code}),
    );
    return ValidatePromoResponse.fromJson(_decode(res));
  }

  /// POST /api/payments/deposit
  Future<DepositResponse> createDeposit(DepositRequest request) async {
    final res = await _http.post(
      _uri('/api/payments/deposit'),
      headers: _headers(),
      body: jsonEncode(request.toJson()),
    );
    return DepositResponse.fromJson(_decode(res));
  }

  /// POST /api/payments/final
  ///
  /// INTEGRATION TODO(WS-B): confirm the request shape — this sends
  /// `{"appointmentId": "..."}`; the frozen contract only pins the response
  /// (`FinalPaymentResponseSchema`).
  Future<FinalPaymentResponse> requestFinalPayment(
    String appointmentId,
  ) async {
    final res = await _http.post(
      _uri('/api/payments/final'),
      headers: _headers(),
      body: jsonEncode({'appointmentId': appointmentId}),
    );
    return FinalPaymentResponse.fromJson(_decode(res));
  }

  /// POST /api/hooks/appointment-en-route
  ///
  /// Fires the customer's "your electrician is on the way" email + push after
  /// the owner flips the appointment to en_route directly in Supabase. Owner
  /// session (bearer) required server-side; callers treat any failure as
  /// non-fatal.
  Future<void> notifyEnRoute(String appointmentId) async {
    final res = await _http.post(
      _uri('/api/hooks/appointment-en-route'),
      headers: _headers(),
      body: jsonEncode({'appointmentId': appointmentId}),
    );
    _decode(res);
  }

  /// GET /api/config → Stripe publishable key resolved server-side.
  ///
  /// Lets a Stripe test↔live switch happen by changing server env + redeploy,
  /// with no new app build. Returns null when the server has no valid key
  /// configured; callers fall back to the compile-time key. Public endpoint —
  /// the publishable key is not a secret.
  Future<String?> getStripePublishableKey() async {
    final res = await _http.get(_uri('/api/config'), headers: _headers());
    final body = _decode(res);
    final key = body['stripePublishableKey'];
    return key is String && key.startsWith('pk_') ? key : null;
  }

  /// POST /api/account/delete
  ///
  /// Permanently deletes the signed-in user's account and personal data. The
  /// server derives the user from the bearer token — no body is sent. Callers
  /// should sign out locally on success. Required for App Store account-
  /// deletion policy (Guideline 5.1.1(v)).
  Future<void> deleteAccount() async {
    final res = await _http.post(
      _uri('/api/account/delete'),
      headers: _headers(),
    );
    _decode(res);
  }

  /// GET /api/tracking/eta?appointmentId=...
  ///
  /// Returns the raw JSON body (expected key: `etaSeconds`). Callers must
  /// treat 401/404/501/503 as "ETA unavailable" — the endpoint is being wired
  /// by a concurrent workstream. (Additive edit by WS-G for the tracking
  /// screens.)
  Future<Map<String, dynamic>> getTrackingEta(String appointmentId) async {
    final res = await _http.get(
      _uri('/api/tracking/eta', {'appointmentId': appointmentId}),
      headers: _headers(),
    );
    return _decode(res);
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    baseUrl: Env.apiBaseUrl,
    accessToken: () =>
        ref.read(supabaseClientProvider).auth.currentSession?.accessToken,
  );
});
