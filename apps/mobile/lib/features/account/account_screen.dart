import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/supabase_provider.dart';
import '../../core/theme.dart';
import '../notifications/fcm_service.dart';
import 'account_providers.dart';
import 'address_form_sheet.dart';

/// Customer account screen (/customer/account): profile edit, address book,
/// payment methods placeholder, sign out.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final addressesAsync = ref.watch(myAddressesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('ACCOUNT'),
        leading: BackButton(onPressed: () => context.go('/customer/home')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionLabel('PROFILE'),
          const _ProfileCard(),
          const SizedBox(height: 20),
          _SectionLabel('ADDRESSES'),
          addressesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Card(
              child: ListTile(
                title: const Text('Could not load addresses'),
                subtitle: Text('$e',
                    style: const TextStyle(color: AppColors.mutedText)),
                trailing: TextButton(
                  onPressed: () => ref.invalidate(myAddressesProvider),
                  child: const Text('Retry'),
                ),
              ),
            ),
            data: (addresses) => Column(
              children: [
                for (final address in addresses)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _AddressCard(address: address),
                  ),
                OutlinedButton.icon(
                  icon: const Icon(Icons.add),
                  label: const Text('Add address'),
                  onPressed: () => showAddressFormSheet(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _SectionLabel('PAYMENT METHODS'),
          const Card(
            child: ListTile(
              leading:
                  Icon(Icons.credit_card_outlined, color: AppColors.amber),
              title: Text('Managed at checkout'),
              subtitle: Text(
                'Cards are saved securely by Stripe when you pay a deposit '
                'with auto-charge consent.',
                style: TextStyle(color: AppColors.mutedText),
              ),
            ),
          ),
          const SizedBox(height: 24),
          _SignOutButton(email: user?.email),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.mutedText,
              letterSpacing: 1.2,
            ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

class _ProfileCard extends ConsumerStatefulWidget {
  const _ProfileCard();

  @override
  ConsumerState<_ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends ConsumerState<_ProfileCard> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _hydrated = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(profileRepositoryProvider).updateProfile(
            fullName: _nameController.text.trim().isEmpty
                ? null
                : _nameController.text.trim(),
            phone: _phoneController.text.trim().isEmpty
                ? null
                : _phoneController.text.trim(),
          );
      messenger.showSnackBar(
        const SnackBar(content: Text('Profile updated.')),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not save profile: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(currentProfileProvider);
    final user = ref.watch(currentUserProvider);

    // Hydrate the fields once when the profile first loads.
    final profile = profileAsync.value;
    if (!_hydrated && profile != null) {
      _hydrated = true;
      _nameController.text = profile.fullName ?? '';
      _phoneController.text = profile.phone ?? '';
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.person_outline, color: AppColors.voltYellow),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    user?.email ?? 'Signed in',
                    style: const TextStyle(color: AppColors.mutedText),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Full name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone'),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.black,
                      ),
                    )
                  : const Text('SAVE PROFILE'),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

class _AddressCard extends ConsumerWidget {
  const _AddressCard({required this.address});

  final Address address;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: ListTile(
        leading: Icon(
          switch (address.propertyType) {
            'commercial' => Icons.storefront_outlined,
            'agricultural' => Icons.agriculture_outlined,
            _ => Icons.home_outlined,
          },
          color: AppColors.amber,
        ),
        title: Row(
          children: [
            Flexible(child: Text(address.label ?? address.line1)),
            if (address.isDefault) ...[
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.voltYellow.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'DEFAULT',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: AppColors.voltYellow,
                  ),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          address.oneLine,
          style: const TextStyle(color: AppColors.mutedText),
        ),
        trailing: PopupMenuButton<String>(
          color: AppColors.surface,
          onSelected: (action) async {
            final messenger = ScaffoldMessenger.of(context);
            if (action == 'edit') {
              await showAddressFormSheet(context, existing: address);
            } else if (action == 'delete') {
              try {
                await ref.read(addressRepositoryProvider).delete(address.id);
              } catch (e) {
                messenger.showSnackBar(SnackBar(
                  content: Text(
                    'Could not delete — it may be linked to an appointment. '
                    '($e)',
                  ),
                ));
              }
            }
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

class _SignOutButton extends ConsumerStatefulWidget {
  const _SignOutButton({this.email});

  final String? email;

  @override
  ConsumerState<_SignOutButton> createState() => _SignOutButtonState();
}

class _SignOutButtonState extends ConsumerState<_SignOutButton> {
  bool _busy = false;

  Future<void> _signOut() async {
    setState(() => _busy = true);
    try {
      // Remove this device's push token first — RLS blocks the delete once
      // the session is gone.
      await ref.read(fcmServiceProvider).unregisterToken();
      await ref.read(supabaseClientProvider).auth.signOut();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      icon: const Icon(Icons.logout),
      label: Text(_busy ? 'SIGNING OUT…' : 'Sign out'),
      onPressed: _busy ? null : _signOut,
    );
  }
}
