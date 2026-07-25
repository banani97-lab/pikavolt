/// Shared owner-UI bits: the live-trip streaming banner and tel:/maps
/// launchers.
library;

import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import '../tracking/owner_trip_service.dart';

/// Dial a phone number (tel:). No-ops with a snackbar if nothing can handle
/// it (e.g. simulator).
Future<void> launchPhone(BuildContext context, String phone) async {
  final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
  final uri = Uri(scheme: 'tel', path: digits);
  final messenger = ScaffoldMessenger.of(context);
  try {
    if (!await launchUrl(uri)) throw 'no handler';
  } catch (e) {
    debugPrint('launchPhone: $e');
    messenger.showSnackBar(SnackBar(content: Text('Call $phone')));
  }
}

/// Open the address in the platform maps app (geo: on Android, Apple Maps
/// on iOS, Google Maps web fallback elsewhere).
Future<void> launchMaps(BuildContext context, Address address) async {
  final query = Uri.encodeComponent(address.oneLine);
  final Uri uri;
  if (!kIsWeb && Platform.isAndroid) {
    uri = Uri.parse('geo:0,0?q=$query');
  } else if (!kIsWeb && Platform.isIOS) {
    uri = Uri.parse('https://maps.apple.com/?q=$query');
  } else {
    uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
  }
  final messenger = ScaffoldMessenger.of(context);
  try {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw 'no handler';
    }
  } catch (e) {
    debugPrint('launchMaps: $e');
    messenger.showSnackBar(
      const SnackBar(content: Text('Could not open the maps app.')),
    );
  }
}

/// Pulsing "LIVE" banner shown across the owner UI while a trip streams.
/// Tapping it jumps to the tracked appointment. Stopping only happens via
/// ARRIVED (or complete/cancel/sign-out/timeout) — no stop button here.
class OwnerTripBanner extends ConsumerWidget {
  const OwnerTripBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trip = ref.watch(ownerTripProvider);
    if (!trip.isActive) return const SizedBox.shrink();

    return Material(
      color: AppColors.voltYellow,
      child: InkWell(
        onTap: () =>
            context.go('/owner/appointments/${trip.appointmentId}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              const _BlinkDot(),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'LIVE — sharing your location with the customer',
                  style: TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ),
              Text(
                '${trip.pingCount} pings',
                style: const TextStyle(color: Colors.black87, fontSize: 12),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, color: Colors.black, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _BlinkDot extends StatefulWidget {
  const _BlinkDot();

  @override
  State<_BlinkDot> createState() => _BlinkDotState();
}

class _BlinkDotState extends State<_BlinkDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.25, end: 1.0).animate(_controller),
      child: Container(
        width: 10,
        height: 10,
        decoration: const BoxDecoration(
          color: AppColors.emergency,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
