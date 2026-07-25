/// Booking wizard state machine — pure logic, unit-tested.
library;

import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/constants.dart';
import '../../core/models/api_models.dart';

/// Wizard steps, in order (mirrors the web booking flow).
enum BookingStep {
  services,
  details,
  address,
  schedule,
  review;

  BookingStep? get next {
    final i = index + 1;
    return i < BookingStep.values.length ? BookingStep.values[i] : null;
  }

  BookingStep? get previous {
    final i = index - 1;
    return i >= 0 ? BookingStep.values[i] : null;
  }

  String get title => switch (this) {
        BookingStep.services => 'Services',
        BookingStep.details => 'Details',
        BookingStep.address => 'Address',
        BookingStep.schedule => 'Schedule',
        BookingStep.review => 'Review & Pay',
      };
}

class BookingState {
  const BookingState({
    this.step = BookingStep.services,
    this.categoryId,
    this.serviceIds = const <String>{},
    this.description = '',
    this.addressId,
    this.selectedDate,
    this.selectedSlot,
    this.promoInput = '',
    this.promo,
    this.autoChargeConsent = false,
    this.termsAccepted = false,
    this.submitting = false,
    this.completed,
  });

  final BookingStep step;
  final String? categoryId;
  final Set<String> serviceIds;
  final String description;
  final String? addressId;

  /// Day selected in the strip (`YYYY-MM-DD` API param comes from this).
  final DateTime? selectedDate;
  final Slot? selectedSlot;
  final String promoInput;

  /// Last successful promo validation (null = none applied).
  final ValidatePromoResponse? promo;
  final bool autoChargeConsent;
  final bool termsAccepted;
  final bool submitting;

  /// Set after a successful deposit — drives the celebration screen.
  final DepositResponse? completed;

  static const Object _unset = Object();

  BookingState copyWith({
    BookingStep? step,
    Object? categoryId = _unset,
    Set<String>? serviceIds,
    String? description,
    Object? addressId = _unset,
    Object? selectedDate = _unset,
    Object? selectedSlot = _unset,
    String? promoInput,
    Object? promo = _unset,
    bool? autoChargeConsent,
    bool? termsAccepted,
    bool? submitting,
    Object? completed = _unset,
  }) {
    return BookingState(
      step: step ?? this.step,
      categoryId:
          categoryId == _unset ? this.categoryId : categoryId as String?,
      serviceIds: serviceIds ?? this.serviceIds,
      description: description ?? this.description,
      addressId: addressId == _unset ? this.addressId : addressId as String?,
      selectedDate: selectedDate == _unset
          ? this.selectedDate
          : selectedDate as DateTime?,
      selectedSlot:
          selectedSlot == _unset ? this.selectedSlot : selectedSlot as Slot?,
      promoInput: promoInput ?? this.promoInput,
      promo: promo == _unset ? this.promo : promo as ValidatePromoResponse?,
      autoChargeConsent: autoChargeConsent ?? this.autoChargeConsent,
      termsAccepted: termsAccepted ?? this.termsAccepted,
      submitting: submitting ?? this.submitting,
      completed:
          completed == _unset ? this.completed : completed as DepositResponse?,
    );
  }

  /// Whether the current step's requirements are met.
  bool get canProceed => switch (step) {
        BookingStep.services => serviceIds.isNotEmpty,
        BookingStep.details => true, // description optional
        BookingStep.address => addressId != null,
        BookingStep.schedule => selectedSlot != null,
        BookingStep.review => termsAccepted && !submitting,
      };

  /// Deposit preview: $75 (50% of the $150 service call fee) minus any promo
  /// discount. Server value is authoritative.
  int get depositPreviewCents {
    final base = BusinessInfo.bookingDepositCents;
    final discount = promo?.previewDiscountCents(base) ?? 0;
    return base - discount;
  }

  /// Builds the exact `POST /api/payments/deposit` body.
  ///
  /// Throws [StateError] when required selections are missing.
  DepositRequest buildDepositRequest() {
    final addressId = this.addressId;
    final slot = selectedSlot;
    if (addressId == null) throw StateError('address not selected');
    if (slot == null) throw StateError('slot not selected');
    if (serviceIds.isEmpty) throw StateError('no services selected');
    if (!termsAccepted) throw StateError('terms not accepted');
    return DepositRequest(
      addressId: addressId,
      scheduledStart: slot.startsAt,
      serviceIds: serviceIds.toList(),
      description: description,
      promoCode: (promo?.valid ?? false) ? promo!.code : null,
      autoChargeConsent: autoChargeConsent,
      termsAccepted: termsAccepted,
    );
  }
}

class BookingController extends Notifier<BookingState> {
  @override
  BookingState build() => const BookingState();

  void reset() => state = const BookingState();

  // ---- navigation ----

  void nextStep() {
    if (!state.canProceed) return;
    final next = state.step.next;
    if (next != null) state = state.copyWith(step: next);
  }

  void previousStep() {
    final previous = state.step.previous;
    if (previous != null) state = state.copyWith(step: previous);
  }

  // ---- step 1: services ----

  void selectCategory(String categoryId) {
    if (state.categoryId == categoryId) return;
    state = state.copyWith(categoryId: categoryId);
  }

  void toggleService(String serviceId) {
    final ids = Set<String>.from(state.serviceIds);
    if (!ids.remove(serviceId)) ids.add(serviceId);
    state = state.copyWith(serviceIds: ids);
  }

  // ---- step 2: details ----

  void setDescription(String value) =>
      state = state.copyWith(description: value);

  // ---- step 3: address ----

  void selectAddress(String? addressId) =>
      state = state.copyWith(addressId: addressId);

  // ---- step 4: schedule ----

  void selectDate(DateTime date) {
    // Changing the day clears any slot picked on the old day.
    state = state.copyWith(selectedDate: date, selectedSlot: null);
  }

  void selectSlot(Slot slot) {
    if (!slot.available) return;
    state = state.copyWith(selectedSlot: slot);
  }

  // ---- step 5: review & pay ----

  void setPromoInput(String value) =>
      state = state.copyWith(promoInput: value);

  void applyPromo(ValidatePromoResponse response) =>
      state = state.copyWith(promo: response.valid ? response : null);

  void clearPromo() => state = state.copyWith(promo: null, promoInput: '');

  void setAutoChargeConsent(bool value) =>
      state = state.copyWith(autoChargeConsent: value);

  void setTermsAccepted(bool value) =>
      state = state.copyWith(termsAccepted: value);

  void setSubmitting(bool value) => state = state.copyWith(submitting: value);

  void markCompleted(DepositResponse response) =>
      state = state.copyWith(completed: response, submitting: false);
}

final bookingControllerProvider =
    NotifierProvider<BookingController, BookingState>(BookingController.new);
