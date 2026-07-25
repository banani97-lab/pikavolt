import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:pikavolt/core/constants.dart';
import 'package:pikavolt/core/models/db_models.dart';
import 'package:pikavolt/core/supabase_provider.dart';
import 'package:pikavolt/core/theme.dart';
import 'package:pikavolt/core/widgets/brand_scaffold.dart';
import 'package:pikavolt/features/appointments/appointments_list_screen.dart';
import 'package:pikavolt/features/appointments/appointments_providers.dart';
import 'package:pikavolt/features/auth/login_screen.dart';
import 'package:pikavolt/features/booking/booking_providers.dart';
import 'package:pikavolt/features/booking/booking_screen.dart';
import 'package:pikavolt/features/home/customer_home_screen.dart';

void main() {
  setUpAll(() {
    // Tests must not hit the network for fonts; fall back to default fonts.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Widget wrap(Widget child) => ProviderScope(
        child: MaterialApp(theme: AppTheme.dark(), home: child),
      );

  // hooks_riverpod 3.3 does not export the `Override` type, so overrides are
  // passed as inline literals (type inferred from ProviderScope.overrides).
  Widget app(Widget child) => MaterialApp(theme: AppTheme.dark(), home: child);

  testWidgets('login screen renders brand and form fields', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));

    expect(find.text('PIKAVOLT'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('SIGN IN'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('login form validates empty submission', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen()));

    await tester.tap(find.text('SIGN IN'));
    await tester.pump();

    expect(find.text('Enter your email'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
  });

  testWidgets('brand scaffold shows bolt mark, title, and subtitle',
      (tester) async {
    await tester.pumpWidget(
      wrap(const BrandScaffold(title: 'Book a Job', subtitle: 'Soon.')),
    );

    expect(find.byIcon(Icons.bolt_rounded), findsOneWidget);
    // Title appears in the app bar and the body.
    expect(find.text('BOOK A JOB'), findsNWidgets(2));
    expect(find.text('Soon.'), findsOneWidget);
  });

  group('customer home', () {
    final appointment = Appointment(
      id: 'appt-1',
      customerId: 'user-1',
      addressId: 'addr-1',
      status: AppointmentStatus.confirmed,
      scheduledStart: DateTime(2026, 7, 20, 13),
      scheduledEnd: DateTime(2026, 7, 20, 15),
    );

    testWidgets(
        'renders greeting, actions, emergency card, and live '
        'next-appointment card', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          currentProfileProvider.overrideWith(
            (ref) async => const Profile(
              id: 'user-1',
              role: UserRole.customer,
              fullName: 'Sam Sparks',
            ),
          ),
          myAppointmentsProvider
              .overrideWith((ref) => Stream.value([appointment])),
        ],
        child: app(const CustomerHomeScreen()),
      ));
      await tester.pump(); // resolve futures/streams

      expect(find.text('HEY, SAM!'), findsOneWidget);
      expect(find.text('Book a Service'), findsOneWidget);
      expect(find.text('My Appointments'), findsOneWidget);
      expect(find.text('NEXT APPOINTMENT'), findsOneWidget);
      expect(find.text('CONFIRMED'), findsOneWidget);

      // The emergency card sits below the fold in the 800x600 test surface.
      await tester.scrollUntilVisible(
        find.text('24/7 EMERGENCY'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('24/7 EMERGENCY'), findsOneWidget);
      expect(find.text('Chat with Pikavolt'), findsOneWidget);
    });

    testWidgets('hides the next-appointment card with no appointments',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          currentProfileProvider.overrideWith((ref) async => null),
          myAppointmentsProvider
              .overrideWith((ref) => Stream.value(const [])),
        ],
        child: app(const CustomerHomeScreen()),
      ));
      await tester.pump();

      expect(find.text('HEY THERE!'), findsOneWidget);
      expect(find.text('NEXT APPOINTMENT'), findsNothing);
    });
  });

  group('booking wizard step 1', () {
    const categories = [
      ServiceCategory(id: 'cat-res', slug: 'residential', name: 'Residential'),
      ServiceCategory(id: 'cat-com', slug: 'commercial', name: 'Commercial'),
    ];
    const services = [
      ServiceItem(id: 'svc-1', categoryId: 'cat-res', name: 'EV Charger'),
      ServiceItem(id: 'svc-2', categoryId: 'cat-res', name: 'Panel Upgrade'),
    ];

    testWidgets('shows categories, services, and gates CONTINUE on selection',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          serviceCategoriesProvider.overrideWith((ref) async => categories),
          servicesByCategoryProvider
              .overrideWith((ref, categoryId) async => services),
        ],
        child: app(const BookingScreen()),
      ));
      await tester.pump(); // categories future
      await tester.pump(); // services future (nested provider)

      expect(find.text('BOOK A SERVICE'), findsOneWidget);
      expect(find.textContaining('STEP 1 OF 5'), findsOneWidget);
      expect(find.text('Residential'), findsOneWidget);
      expect(find.text('EV Charger'), findsOneWidget);

      // Continue disabled until a service is picked.
      final continueButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'CONTINUE'),
      );
      expect(continueButton.onPressed, isNull);

      await tester.tap(find.text('EV Charger'));
      await tester.pump();
      expect(find.text('1 selected'), findsOneWidget);
      final enabledButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'CONTINUE'),
      );
      expect(enabledButton.onPressed, isNotNull);
    });
  });

  group('appointments list', () {
    testWidgets('shows the mascot empty state on the upcoming tab',
        (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          myAppointmentsProvider
              .overrideWith((ref) => Stream.value(const [])),
        ],
        child: app(const AppointmentsListScreen()),
      ));
      await tester.pump();

      expect(find.text('MY APPOINTMENTS'), findsOneWidget);
      expect(find.text('Upcoming'), findsOneWidget);
      expect(find.text('Past'), findsOneWidget);
      expect(find.text('NOTHING BOOKED YET'), findsOneWidget);
    });
  });
}
