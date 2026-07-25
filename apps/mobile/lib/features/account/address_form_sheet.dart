import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../core/models/db_models.dart';
import '../../core/theme.dart';
import 'account_providers.dart';

/// Opens the add/edit address bottom sheet. Returns the created/updated
/// address id, or null when dismissed.
Future<String?> showAddressFormSheet(
  BuildContext context, {
  Address? existing,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _AddressFormSheet(existing: existing),
  );
}

class _AddressFormSheet extends ConsumerStatefulWidget {
  const _AddressFormSheet({this.existing});

  final Address? existing;

  @override
  ConsumerState<_AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends ConsumerState<_AddressFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _label = TextEditingController(text: widget.existing?.label);
  late final _line1 = TextEditingController(text: widget.existing?.line1);
  late final _line2 = TextEditingController(text: widget.existing?.line2);
  late final _city = TextEditingController(text: widget.existing?.city);
  late final _zip = TextEditingController(text: widget.existing?.zip);
  late String _propertyType =
      widget.existing?.propertyType ?? 'residential';
  late bool _isDefault = widget.existing?.isDefault ?? false;
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_label, _line1, _line2, _city, _zip]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final repo = ref.read(addressRepositoryProvider);
    try {
      String id;
      if (widget.existing == null) {
        final created = await repo.create(
          label: _label.text.trim().isEmpty ? null : _label.text.trim(),
          line1: _line1.text.trim(),
          line2: _line2.text.trim().isEmpty ? null : _line2.text.trim(),
          city: _city.text.trim(),
          zip: _zip.text.trim(),
          propertyType: _propertyType,
          isDefault: _isDefault,
        );
        id = created.id;
      } else {
        await repo.update(
          widget.existing!.id,
          label: _label.text.trim().isEmpty ? null : _label.text.trim(),
          line1: _line1.text.trim(),
          line2: _line2.text.trim().isEmpty ? null : _line2.text.trim(),
          city: _city.text.trim(),
          zip: _zip.text.trim(),
          propertyType: _propertyType,
          isDefault: _isDefault,
        );
        id = widget.existing!.id;
      }
      if (mounted) Navigator.of(context).pop(id);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save address: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.existing == null ? 'ADD ADDRESS' : 'EDIT ADDRESS',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _label,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Label (optional)',
                    hintText: 'Home, Barn, Office…',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _line1,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Street address'),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Enter a street address'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _line2,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Apt / suite (optional)',
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _city,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'City'),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Enter a city'
                            : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _zip,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'ZIP'),
                        validator: (v) => (v == null || v.trim().length < 5)
                            ? 'ZIP'
                            : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _propertyType,
                  decoration: const InputDecoration(labelText: 'Property type'),
                  dropdownColor: AppColors.surface,
                  items: const [
                    DropdownMenuItem(
                        value: 'residential', child: Text('Residential')),
                    DropdownMenuItem(
                        value: 'commercial', child: Text('Commercial')),
                    DropdownMenuItem(
                        value: 'agricultural',
                        child: Text('Agricultural / Farm')),
                  ],
                  onChanged: (v) =>
                      setState(() => _propertyType = v ?? 'residential'),
                ),
                CheckboxListTile(
                  value: _isDefault,
                  onChanged: (v) => setState(() => _isDefault = v ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text('Set as default address'),
                ),
                const SizedBox(height: 8),
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
                      : Text(widget.existing == null
                          ? 'SAVE ADDRESS'
                          : 'UPDATE ADDRESS'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
