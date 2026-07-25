import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/constants.dart';
import '../../core/models/api_models.dart';
import '../../core/models/db_models.dart';
import '../../core/money.dart';
import '../../core/theme.dart';
import '../../core/widgets/mascot.dart';
import '../account/account_providers.dart';
import '../account/address_form_sheet.dart';
import '../payments/payments_service.dart';
import 'booking_providers.dart';
import 'booking_state.dart';
import 'slot_utils.dart';

/// Customer booking wizard (/customer/book).
///
/// Steps: Services -> Details -> Address -> Schedule -> Review & Pay,
/// finishing with a $75 Stripe deposit (50% of the $150 service call fee).
class BookingScreen extends ConsumerWidget {
  const BookingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(bookingControllerProvider);

    if (state.completed != null) {
      return _SuccessView(response: state.completed!);
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('BOOK A SERVICE'),
        leading: BackButton(
          onPressed: () {
            if (state.step == BookingStep.services) {
              ref.read(bookingControllerProvider.notifier).reset();
              context.go('/customer/home');
            } else {
              ref.read(bookingControllerProvider.notifier).previousStep();
            }
          },
        ),
      ),
      body: Column(
        children: [
          _StepHeader(step: state.step),
          Expanded(
            child: switch (state.step) {
              BookingStep.services => const _ServicesStep(),
              BookingStep.details => const _DetailsStep(),
              BookingStep.address => const _AddressStep(),
              BookingStep.schedule => const _ScheduleStep(),
              BookingStep.review => const _ReviewStep(),
            },
          ),
          _BottomBar(state: state),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step header / bottom bar
// ---------------------------------------------------------------------------

class _StepHeader extends StatelessWidget {
  const _StepHeader({required this.step});

  final BookingStep step;

  @override
  Widget build(BuildContext context) {
    final steps = BookingStep.values;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (final s in steps) ...[
                Expanded(
                  child: Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: s.index <= step.index
                          ? AppColors.voltYellow
                          : AppColors.outline,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                if (s != steps.last) const SizedBox(width: 6),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'STEP ${step.index + 1} OF ${steps.length} — ${step.title}'
                .toUpperCase(),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.mutedText,
                  letterSpacing: 1.1,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _BottomBar extends ConsumerWidget {
  const _BottomBar({required this.state});

  final BookingState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isReview = state.step == BookingStep.review;
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: isReview
          ? _PayButton(state: state)
          : ElevatedButton(
              onPressed: state.canProceed
                  ? () =>
                      ref.read(bookingControllerProvider.notifier).nextStep()
                  : null,
              child: const Text('CONTINUE'),
            ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Services
// ---------------------------------------------------------------------------

class _ServicesStep extends ConsumerWidget {
  const _ServicesStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(serviceCategoriesProvider);
    final state = ref.watch(bookingControllerProvider);
    final controller = ref.read(bookingControllerProvider.notifier);

    return categoriesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorRetry(
        message: 'Could not load services.',
        onRetry: () => ref.invalidate(serviceCategoriesProvider),
      ),
      data: (categories) {
        final selectedCategoryId = state.categoryId ??
            (categories.isEmpty ? null : categories.first.id);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'What do you need help with?',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: categories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final category = categories[i];
                  final selected = category.id == selectedCategoryId;
                  return ChoiceChip(
                    label: Text(category.name),
                    selected: selected,
                    onSelected: (_) => controller.selectCategory(category.id),
                    selectedColor:
                        AppColors.voltYellow.withValues(alpha: 0.18),
                    labelStyle: TextStyle(
                      color: selected
                          ? AppColors.voltYellow
                          : AppColors.onDark,
                      fontWeight:
                          selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                    side: BorderSide(
                      color: selected
                          ? AppColors.voltYellow
                          : AppColors.outline,
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            if (state.serviceIds.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  '${state.serviceIds.length} selected',
                  style: const TextStyle(
                    color: AppColors.voltYellow,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            Expanded(
              child: selectedCategoryId == null
                  ? const SizedBox.shrink()
                  : _ServiceList(categoryId: selectedCategoryId),
            ),
          ],
        );
      },
    );
  }
}

class _ServiceList extends ConsumerWidget {
  const _ServiceList({required this.categoryId});

  final String categoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(servicesByCategoryProvider(categoryId));
    final selected =
        ref.watch(bookingControllerProvider.select((s) => s.serviceIds));
    final controller = ref.read(bookingControllerProvider.notifier);

    return servicesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorRetry(
        message: 'Could not load services.',
        onRetry: () => ref.invalidate(servicesByCategoryProvider(categoryId)),
      ),
      data: (services) => ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        itemCount: services.length,
        itemBuilder: (context, i) {
          final service = services[i];
          final isSelected = selected.contains(service.id);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color:
                      isSelected ? AppColors.voltYellow : AppColors.outline,
                ),
              ),
              child: CheckboxListTile(
                value: isSelected,
                onChanged: (_) => controller.toggleService(service.id),
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(service.name),
                dense: true,
              ),
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Details
// ---------------------------------------------------------------------------

class _DetailsStep extends ConsumerStatefulWidget {
  const _DetailsStep();

  @override
  ConsumerState<_DetailsStep> createState() => _DetailsStepState();
}

class _DetailsStepState extends ConsumerState<_DetailsStep> {
  late final TextEditingController _controller = TextEditingController(
    text: ref.read(bookingControllerProvider).description,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Tell us about the job',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        const Text(
          'A few details help us show up prepared. Optional, but the more we '
          'know the faster we work.',
          style: TextStyle(color: AppColors.mutedText),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _controller,
          maxLines: 6,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText: 'e.g. Two dead outlets in the kitchen, breaker keeps '
                'tripping…',
          ),
          onChanged: (v) =>
              ref.read(bookingControllerProvider.notifier).setDescription(v),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Address
// ---------------------------------------------------------------------------

class _AddressStep extends ConsumerWidget {
  const _AddressStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressesAsync = ref.watch(myAddressesProvider);
    final selectedId =
        ref.watch(bookingControllerProvider.select((s) => s.addressId));
    final controller = ref.read(bookingControllerProvider.notifier);

    return addressesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorRetry(
        message: 'Could not load your addresses.',
        onRetry: () => ref.invalidate(myAddressesProvider),
      ),
      data: (addresses) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Where is the job?',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          for (final address in addresses)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _AddressTile(
                address: address,
                selected: address.id == selectedId,
                onTap: () => controller.selectAddress(address.id),
              ),
            ),
          if (addresses.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No saved addresses yet — add one to continue.',
                style: TextStyle(color: AppColors.mutedText),
              ),
            ),
          OutlinedButton.icon(
            icon: const Icon(Icons.add),
            label: const Text('Add a new address'),
            onPressed: () async {
              final newId = await showAddressFormSheet(context);
              if (newId != null) controller.selectAddress(newId);
            },
          ),
        ],
      ),
    );
  }
}

class _AddressTile extends StatelessWidget {
  const _AddressTile({
    required this.address,
    required this.selected,
    required this.onTap,
  });

  final Address address;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: selected ? AppColors.voltYellow : AppColors.outline,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(
          switch (address.propertyType) {
            'commercial' => Icons.storefront_outlined,
            'agricultural' => Icons.agriculture_outlined,
            _ => Icons.home_outlined,
          },
          color: selected ? AppColors.voltYellow : AppColors.mutedText,
        ),
        title: Text(address.label ?? address.line1),
        subtitle: Text(
          address.oneLine,
          style: const TextStyle(color: AppColors.mutedText),
        ),
        trailing: selected
            ? const Icon(Icons.check_circle, color: AppColors.voltYellow)
            : null,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Schedule (day strip + slot chips)
// ---------------------------------------------------------------------------

class _ScheduleStep extends ConsumerStatefulWidget {
  const _ScheduleStep();

  @override
  ConsumerState<_ScheduleStep> createState() => _ScheduleStepState();
}

class _ScheduleStepState extends ConsumerState<_ScheduleStep> {
  @override
  void initState() {
    super.initState();
    // Default the strip to today so slots load immediately.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (ref.read(bookingControllerProvider).selectedDate == null) {
        ref
            .read(bookingControllerProvider.notifier)
            .selectDate(dateOnly(DateTime.now()));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bookingControllerProvider);
    final controller = ref.read(bookingControllerProvider.notifier);
    final days = upcomingDays(DateTime.now());
    final selectedDate = state.selectedDate ?? days.first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Pick a day and time',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 76,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: days.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final day = days[i];
              final selected = isSameDay(day, selectedDate);
              return GestureDetector(
                onTap: () => controller.selectDate(day),
                child: Container(
                  width: 60,
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.voltYellow.withValues(alpha: 0.16)
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: selected
                          ? AppColors.voltYellow
                          : AppColors.outline,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        weekdayShort(day).toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: selected
                              ? AppColors.voltYellow
                              : AppColors.mutedText,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: selected
                              ? AppColors.voltYellow
                              : AppColors.onDark,
                        ),
                      ),
                      Text(
                        monthShort(day),
                        style: const TextStyle(
                          fontSize: 10,
                          color: AppColors.mutedText,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
        Expanded(child: _SlotGrid(date: selectedDate)),
      ],
    );
  }
}

class _SlotGrid extends ConsumerWidget {
  const _SlotGrid({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dateParam = formatDateParam(date);
    final slotsAsync = ref.watch(slotsForDateProvider(dateParam));
    final selectedSlot =
        ref.watch(bookingControllerProvider.select((s) => s.selectedSlot));
    final controller = ref.read(bookingControllerProvider.notifier);

    return slotsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) {
        final pending = e is ApiException && e.isNotImplemented;
        return _ErrorRetry(
          message: pending
              ? 'Scheduling isn\'t available yet — the booking API is still '
                  'being wired up. Try again soon.'
              : 'Could not load time slots. Check your connection and the '
                  'API server.',
          onRetry: () => ref.invalidate(slotsForDateProvider(dateParam)),
        );
      },
      data: (slots) {
        if (slots.isEmpty) {
          return const Center(
            child: Text(
              'No slots on this day — try another.',
              style: TextStyle(color: AppColors.mutedText),
            ),
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 2.4,
          ),
          itemCount: slots.length,
          itemBuilder: (context, i) {
            final slot = slots[i];
            final isSelected = selectedSlot?.startsAt == slot.startsAt;
            return GestureDetector(
              onTap:
                  slot.available ? () => controller.selectSlot(slot) : null,
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.voltYellow
                      : slot.available
                          ? AppColors.surface
                          : AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.voltYellow
                        : AppColors.outline,
                  ),
                ),
                child: Text(
                  timeLabel(slot.startsAtLocal),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: isSelected
                        ? Colors.black
                        : slot.available
                            ? AppColors.onDark
                            : AppColors.mutedText.withValues(alpha: 0.5),
                    decoration:
                        slot.available ? null : TextDecoration.lineThrough,
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Review & Pay
// ---------------------------------------------------------------------------

class _ReviewStep extends ConsumerStatefulWidget {
  const _ReviewStep();

  @override
  ConsumerState<_ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends ConsumerState<_ReviewStep> {
  late final TextEditingController _promoController = TextEditingController(
    text: ref.read(bookingControllerProvider).promoInput,
  );
  bool _validatingPromo = false;

  @override
  void dispose() {
    _promoController.dispose();
    super.dispose();
  }

  Future<void> _applyPromo() async {
    final code = _promoController.text.trim();
    if (code.isEmpty) return;
    setState(() => _validatingPromo = true);
    final controller = ref.read(bookingControllerProvider.notifier);
    try {
      final response = await ref.read(apiClientProvider).validatePromo(code);
      controller.applyPromo(response);
      if (!mounted) return;
      if (!response.valid) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('That promo code isn\'t valid.')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(e.isNotImplemented
            ? 'Promo validation isn\'t available yet.'
            : 'Could not check that code (${e.statusCode}).'),
      ));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not reach the server.')),
      );
    } finally {
      if (mounted) setState(() => _validatingPromo = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bookingControllerProvider);
    final controller = ref.read(bookingControllerProvider.notifier);
    final slot = state.selectedSlot;
    final textTheme = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('YOUR VISIT', style: textTheme.headlineSmall),
                const SizedBox(height: 12),
                _SummaryRow(
                  icon: Icons.handyman_outlined,
                  text: '${state.serviceIds.length} service'
                      '${state.serviceIds.length == 1 ? '' : 's'} selected',
                ),
                if (slot != null)
                  _SummaryRow(
                    icon: Icons.event_outlined,
                    text: '${weekdayShort(slot.startsAtLocal)}, '
                        '${monthShort(slot.startsAtLocal)} '
                        '${slot.startsAtLocal.day} at '
                        '${timeLabel(slot.startsAtLocal)}',
                  ),
                if (state.description.trim().isNotEmpty)
                  _SummaryRow(
                    icon: Icons.notes_outlined,
                    text: state.description.trim(),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Promo code
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: TextField(
                controller: _promoController,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(hintText: 'Promo code'),
                onChanged: controller.setPromoInput,
                enabled: state.promo == null,
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 100,
              child: state.promo == null
                  ? OutlinedButton(
                      onPressed: _validatingPromo ? null : _applyPromo,
                      child: _validatingPromo
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Apply'),
                    )
                  : OutlinedButton(
                      onPressed: () {
                        controller.clearPromo();
                        _promoController.clear();
                      },
                      child: const Text('Remove'),
                    ),
            ),
          ],
        ),
        if (state.promo != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Promo ${state.promo!.code} applied — you save '
              '${formatCents(state.promo!.previewDiscountCents(BusinessInfo.bookingDepositCents))}.',
              style: const TextStyle(
                color: AppColors.arcBlue,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        const SizedBox(height: 16),
        // Deposit summary
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _PriceRow(
                  label: 'Service call fee',
                  value: formatCents(BusinessInfo.serviceCallFeeCents),
                ),
                _PriceRow(
                  label: 'Due today (50% deposit)',
                  value: formatCents(BusinessInfo.bookingDepositCents),
                ),
                if (state.promo != null)
                  _PriceRow(
                    label: 'Promo discount',
                    value:
                        '-${formatCents(state.promo!.previewDiscountCents(BusinessInfo.bookingDepositCents))}',
                    color: AppColors.arcBlue,
                  ),
                const Divider(height: 20),
                _PriceRow(
                  label: 'TOTAL DUE NOW',
                  value: formatCents(state.depositPreviewCents),
                  bold: true,
                  color: AppColors.voltYellow,
                ),
                const SizedBox(height: 4),
                const Text(
                  'The remaining 50% plus the job total is due on completion.',
                  style: TextStyle(color: AppColors.mutedText, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Consents
        CheckboxListTile(
          value: state.termsAccepted,
          onChanged: (v) => controller.setTermsAccepted(v ?? false),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          title: const Text('I agree to the terms of service (required)'),
          subtitle: const Text(
            'Cancellation policy: cancel at least 24 hours before your slot '
            'for a full deposit refund. Later cancellations forfeit the '
            'deposit.',
            style: TextStyle(color: AppColors.mutedText, fontSize: 12),
          ),
        ),
        CheckboxListTile(
          value: state.autoChargeConsent,
          onChanged: (v) => controller.setAutoChargeConsent(v ?? false),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          title: const Text('Save my card and auto-charge the final payment '
              '(optional)'),
          subtitle: const Text(
            'When the job is done we charge the remaining balance to the '
            'same card. Otherwise we send you a payment link.',
            style: TextStyle(color: AppColors.mutedText, fontSize: 12),
          ),
        ),
        if (!PaymentsService.isEnabled)
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.amber),
            ),
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: AppColors.amber),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Payments are unavailable in this build — no Stripe '
                      'key was configured. Booking cannot be completed yet.',
                      style: TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _PayButton extends ConsumerWidget {
  const _PayButton({required this.state});

  final BookingState state;

  Future<void> _payDeposit(BuildContext context, WidgetRef ref) async {
    final controller = ref.read(bookingControllerProvider.notifier);
    final messenger = ScaffoldMessenger.of(context);
    controller.setSubmitting(true);
    try {
      final request =
          ref.read(bookingControllerProvider).buildDepositRequest();
      final response =
          await ref.read(apiClientProvider).createDeposit(request);
      final result =
          await ref.read(paymentsServiceProvider).presentPaymentSheet(
                clientSecret: response.paymentIntentClientSecret,
              );
      switch (result) {
        case PaymentSheetResult.success:
          controller.markCompleted(response);
        case PaymentSheetResult.cancelled:
          controller.setSubmitting(false);
          messenger.showSnackBar(const SnackBar(
            content: Text('Payment cancelled — your slot isn\'t confirmed '
                'until the deposit is paid.'),
          ));
        case PaymentSheetResult.failed:
          controller.setSubmitting(false);
          messenger.showSnackBar(const SnackBar(
            content: Text(
                'Payment failed. You have not been charged — try again.'),
          ));
      }
    } on ApiException catch (e) {
      controller.setSubmitting(false);
      messenger.showSnackBar(SnackBar(
        content: Text(e.isNotImplemented
            ? 'Booking isn\'t available yet — the payments API is still '
                'being wired up.'
            : 'Booking failed (${e.statusCode}): ${e.message}'),
      ));
    } catch (e) {
      controller.setSubmitting(false);
      messenger.showSnackBar(
        SnackBar(content: Text('Booking failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enabled =
        state.canProceed && PaymentsService.isEnabled && !state.submitting;
    return ElevatedButton(
      onPressed: enabled ? () => _payDeposit(context, ref) : null,
      child: state.submitting
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.black,
              ),
            )
          : Text('PAY ${formatCents(state.depositPreviewCents)} DEPOSIT'),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.amber),
          const SizedBox(width: 10),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.color,
  });

  final String label;
  final String value;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
      color: color ?? (bold ? AppColors.onDark : AppColors.mutedText),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label, style: style)),
          Text(value, style: style),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

class _SuccessView extends ConsumerWidget {
  const _SuccessView({required this.response});

  final DepositResponse response;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              const Mascot(height: 180),
              const SizedBox(height: 24),
              Text('YOU\'RE BOOKED!', style: textTheme.displaySmall),
              const SizedBox(height: 12),
              Text(
                'Deposit of ${formatCents(response.depositCents)} received. '
                'We\'ll confirm your appointment shortly — watch for a '
                'notification.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.mutedText),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: () {
                  final id = response.appointmentId;
                  ref.read(bookingControllerProvider.notifier).reset();
                  context.go('/customer/appointments/$id');
                },
                child: const Text('VIEW APPOINTMENT'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () {
                  ref.read(bookingControllerProvider.notifier).reset();
                  context.go('/customer/home');
                },
                child: const Text('BACK TO HOME'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined,
                color: AppColors.mutedText, size: 40),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.mutedText),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
