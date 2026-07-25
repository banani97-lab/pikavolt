/// Customer live tracking (/customer/appointments/:id/track).
///
/// Two render modes sharing the same providers (tracking_providers.dart):
/// - `Env.googleMapsConfigured` true  -> dark-styled google_maps_flutter map
///   with an animated technician marker (lerped between pings) and a
///   destination pin.
/// - false (current default; the manifest/AppDelegate keys are TODO
///   placeholders) -> branded radar fallback with a pulsing sweep, live
///   distance/heading text, and the same ETA banner.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/env.dart';
import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../appointments/appointments_providers.dart';
import 'tracking_providers.dart';
import 'trip_throttle.dart';

class CustomerMapScreen extends ConsumerWidget {
  const CustomerMapScreen({super.key, required this.appointmentId});

  final String appointmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointmentAsync = ref.watch(appointmentProvider(appointmentId));
    final sessionAsync = ref.watch(trackingSessionProvider(appointmentId));
    final ping = ref.watch(latestPingProvider(appointmentId));

    final address = appointmentAsync.value == null
        ? null
        : ref
            .watch(addressByIdProvider(appointmentAsync.value!.addressId))
            .value;

    final session = sessionAsync.value;
    final ended = session != null && !session.isLive;

    return Scaffold(
      appBar: AppBar(
        title: const Text('LIVE TRACKING'),
        leading: BackButton(
          onPressed: () =>
              context.go('/customer/appointments/$appointmentId'),
        ),
      ),
      body: Column(
        children: [
          _EtaBanner(appointmentId: appointmentId, ended: ended),
          Expanded(
            child: ended
                ? const _TrackingEnded()
                : Env.googleMapsConfigured
                    ? _TrackingMap(ping: ping, address: address)
                    : _RadarFallback(ping: ping, address: address),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// ETA banner (shared by both modes)
// ---------------------------------------------------------------------------

class _EtaBanner extends ConsumerWidget {
  const _EtaBanner({required this.appointmentId, required this.ended});

  final String appointmentId;
  final bool ended;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eta = ref.watch(trackingEtaProvider(appointmentId)).value;
    final String text;
    if (ended) {
      text = 'Your electrician has arrived.';
    } else if (eta != null && eta > 0) {
      final minutes = (eta / 60).ceil();
      text = 'Arriving in about $minutes min';
    } else {
      text = 'Your electrician is on the way';
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.outline)),
      ),
      child: Row(
        children: [
          Icon(
            ended ? Icons.check_circle_outline : Icons.electric_bolt,
            color: ended ? const Color(0xFF34D399) : AppColors.voltYellow,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _TrackingEnded extends StatelessWidget {
  const _TrackingEnded();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Mascot(height: 120),
            const SizedBox(height: 16),
            Text('THEY MADE IT!',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              'Live tracking ends once your electrician arrives.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.mutedText),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mode 1: Google Map (GOOGLE_MAPS_CONFIGURED=true)
// ---------------------------------------------------------------------------

class _TrackingMap extends StatefulWidget {
  const _TrackingMap({required this.ping, required this.address});

  final TrackingPing? ping;
  final Address? address;

  @override
  State<_TrackingMap> createState() => _TrackingMapState();
}

class _TrackingMapState extends State<_TrackingMap>
    with SingleTickerProviderStateMixin {
  static const _fallbackCenter = LatLng(40.0992, -83.1141); // Dublin, OH

  late final AnimationController _lerp = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..addListener(() => setState(() {}));

  GoogleMapController? _controller;
  LatLng? _from;
  LatLng? _to;

  @override
  void didUpdateWidget(_TrackingMap old) {
    super.didUpdateWidget(old);
    final ping = widget.ping;
    if (ping == null) return;
    final next = LatLng(ping.lat, ping.lng);
    if (_to == next) return;
    _from = _currentMarkerPosition() ?? next;
    _to = next;
    _lerp.forward(from: 0);
    unawaited(
      _controller?.animateCamera(CameraUpdate.newLatLng(next)),
    );
  }

  LatLng? _currentMarkerPosition() {
    final from = _from;
    final to = _to;
    if (to == null) return null;
    if (from == null) return to;
    final t = Curves.easeInOut.transform(_lerp.value);
    return LatLng(
      from.latitude + (to.latitude - from.latitude) * t,
      from.longitude + (to.longitude - from.longitude) * t,
    );
  }

  @override
  void dispose() {
    _lerp.dispose();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ping = widget.ping;
    final address = widget.address;
    final tech = _currentMarkerPosition() ??
        (ping == null ? null : LatLng(ping.lat, ping.lng));
    final destination = (address?.lat != null && address?.lng != null)
        ? LatLng(address!.lat!, address.lng!)
        : null;

    return GoogleMap(
      initialCameraPosition: CameraPosition(
        target: tech ?? destination ?? _fallbackCenter,
        zoom: 13,
      ),
      style: _darkMapStyle,
      onMapCreated: (controller) => _controller = controller,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      compassEnabled: false,
      mapToolbarEnabled: false,
      markers: {
        if (tech != null)
          Marker(
            markerId: const MarkerId('technician'),
            position: tech,
            rotation: ping?.heading ?? 0,
            anchor: const Offset(0.5, 0.5),
            flat: true,
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueYellow,
            ),
            infoWindow: const InfoWindow(title: 'Your electrician'),
          ),
        if (destination != null)
          Marker(
            markerId: const MarkerId('destination'),
            position: destination,
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueCyan,
            ),
            infoWindow: const InfoWindow(title: 'Your address'),
          ),
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Mode 2: branded radar fallback (no Maps key yet)
// ---------------------------------------------------------------------------

class _RadarFallback extends StatefulWidget {
  const _RadarFallback({required this.ping, required this.address});

  final TrackingPing? ping;
  final Address? address;

  @override
  State<_RadarFallback> createState() => _RadarFallbackState();
}

class _RadarFallbackState extends State<_RadarFallback>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  )..repeat();

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ping = widget.ping;
    final address = widget.address;

    double? distanceMeters;
    if (ping != null && address?.lat != null && address?.lng != null) {
      distanceMeters =
          haversineMeters(ping.lat, ping.lng, address!.lat!, address.lng!);
    }

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Spacer(),
          SizedBox(
            width: 240,
            height: 240,
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) =>
                  CustomPaint(painter: _RadarPainter(progress: _pulse.value)),
            ),
          ),
          const SizedBox(height: 32),
          if (ping == null) ...[
            Text('LOCKING ON…',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              'Waiting for the first location update from your electrician.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.mutedText),
            ),
          ] else ...[
            if (distanceMeters != null)
              Text(
                _distanceLabel(distanceMeters),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: AppColors.voltYellow,
                    ),
              )
            else
              Text('ON THE MOVE',
                  style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              _subtitle(ping, distanceMeters),
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.mutedText),
            ),
            const SizedBox(height: 6),
            Text(
              'Updated ${_agoLabel(ping.ts)}',
              style: const TextStyle(
                color: AppColors.mutedText,
                fontSize: 12,
              ),
            ),
          ],
          const Spacer(),
          const Text(
            'Map view lights up once maps are configured — live updates '
            'work either way.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.mutedText, fontSize: 12),
          ),
        ],
      ),
    );
  }

  String _distanceLabel(double meters) {
    final miles = meters / 1609.344;
    if (miles < 0.1) return 'PULLING UP NOW';
    return '${miles.toStringAsFixed(miles < 10 ? 1 : 0)} MI AWAY';
  }

  String _subtitle(TrackingPing ping, double? distanceMeters) {
    final parts = <String>[];
    if (ping.heading != null) {
      parts.add('heading ${compassLabel(ping.heading!)}');
    }
    if (ping.speed != null && ping.speed! > 0.5) {
      parts.add('${(ping.speed! * 2.23694).round()} mph');
    }
    if (parts.isEmpty) {
      return distanceMeters == null
          ? 'Your electrician is en route.'
          : 'Closing in on your address.';
    }
    return 'Your electrician is ${parts.join(' at ')}.';
  }

  String _agoLabel(DateTime ts) {
    final diff = DateTime.now().toUtc().difference(ts.toUtc());
    if (diff.inSeconds < 10) return 'just now';
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    return '${diff.inMinutes}m ago';
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;

    // Static rings.
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = AppColors.teal.withValues(alpha: 0.6);
    for (final f in [0.33, 0.66, 1.0]) {
      canvas.drawCircle(center, maxRadius * f, ring);
    }

    // Expanding pulse.
    final pulsePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = AppColors.arcBlue.withValues(alpha: 1 - progress);
    canvas.drawCircle(center, maxRadius * progress, pulsePaint);

    // Center bolt dot.
    canvas.drawCircle(
      center,
      10,
      Paint()..color = AppColors.voltYellow,
    );
    canvas.drawCircle(
      center,
      16,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = AppColors.voltYellow.withValues(
          alpha: 0.4 + 0.3 * (1 - progress),
        ),
    );
  }

  @override
  bool shouldRepaint(_RadarPainter old) => old.progress != progress;
}

// ---------------------------------------------------------------------------
// Dark map style (brand: storm/teal)
// ---------------------------------------------------------------------------

const String _darkMapStyle = '''
[
  {"elementType": "geometry", "stylers": [{"color": "#0e2a33"}]},
  {"elementType": "labels.text.fill", "stylers": [{"color": "#9fb8c2"}]},
  {"elementType": "labels.text.stroke", "stylers": [{"color": "#081a21"}]},
  {"featureType": "poi", "stylers": [{"visibility": "off"}]},
  {"featureType": "transit", "stylers": [{"visibility": "off"}]},
  {"featureType": "road", "elementType": "geometry",
   "stylers": [{"color": "#1b4254"}]},
  {"featureType": "road", "elementType": "geometry.stroke",
   "stylers": [{"color": "#081a21"}]},
  {"featureType": "road.highway", "elementType": "geometry",
   "stylers": [{"color": "#2a5e73"}]},
  {"featureType": "water", "elementType": "geometry",
   "stylers": [{"color": "#081a21"}]}
]
''';
