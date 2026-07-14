import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/confirm_dialog.dart';
import '../../data/repositories/prl_repository.dart';
import '../../providers/prl_provider.dart';

class PrlFormScreen extends ConsumerStatefulWidget {
  const PrlFormScreen({super.key});

  @override
  ConsumerState<PrlFormScreen> createState() => _PrlFormScreenState();
}

class _PrlFormScreenState extends ConsumerState<PrlFormScreen> {
  final _lines = <_PrlLineEntry>[];
  bool _saving = false;

  late final FormGroup _form = FormGroup({
    'locationId':   FormControl<String>(validators: [Validators.required]),
    'chargeCodeId': FormControl<String>(validators: [Validators.required]),
    'docDate':      FormControl<DateTime>(value: DateTime.now(), validators: [Validators.required]),
    'deliveryDate': FormControl<DateTime>(validators: [Validators.required]),
    'remarks':      FormControl<String>(),
  });

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_form.invalid) {
      _form.markAllAsTouched();
      return;
    }
    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Add at least one line item.'),
        backgroundColor: AppColours.statusPartial,
      ));
      return;
    }
    final ok = await ConfirmDialog.show(
      context,
      title: 'Create Purchase Requisition',
      message: 'Save as draft?',
      confirmLabel: 'Save',
    );
    if (!ok || !context.mounted) return;

    setState(() => _saving = true);
    try {
      await ref.read(prlRepositoryProvider).create({
        'locationId':   _form.control('locationId').value,
        'chargeCodeId': _form.control('chargeCodeId').value,
        'docDate':      FormatUtils.toApiDate(_form.control('docDate').value as DateTime),
        'deliveryDate': FormatUtils.toApiDate(_form.control('deliveryDate').value as DateTime),
        'remarks':      _form.control('remarks').value,
        'lines':        _lines.map((l) => l.toJson()).toList(),
      });
      ref.invalidate(prlListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('PRL created successfully.'),
          backgroundColor: AppColours.statusApproved,
        ));
        context.pop();
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColours.statusRejected,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('New Purchase Requisition'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        color: AppColours.surface, strokeWidth: 2))
                : const Text('Save',
                    style: TextStyle(
                        color: AppColours.surface,
                        fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: ReactiveForm(
        formGroup: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _header('Header'),
            const SizedBox(height: 8),
            ReactiveTextField<String>(
              formControlName: 'locationId',
              decoration: const InputDecoration(
                labelText: 'Location *',
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Required',
              },
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'chargeCodeId',
              decoration: const InputDecoration(
                labelText: 'Charge Code *',
                prefixIcon: Icon(Icons.code),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Required',
              },
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _dateField('docDate', 'Document Date *')),
              const SizedBox(width: 12),
              Expanded(child: _dateField('deliveryDate', 'Delivery Date *')),
            ]),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'remarks',
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Remarks',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _header('Lines'),
                TextButton.icon(
                  onPressed: () =>
                      setState(() => _lines.add(_PrlLineEntry())),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add Line'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_lines.isEmpty)
              _emptyLines(),
            ...List.generate(
              _lines.length,
              (i) => _PrlLineForm(
                key: ValueKey(i),
                entry: _lines[i],
                index: i + 1,
                onRemove: () => setState(() => _lines.removeAt(i)),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _dateField(String name, String label) {
    return ReactiveTextField<DateTime>(
      formControlName: name,
      readOnly: true,
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: (_form.control(name).value as DateTime?) ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime(2030),
        );
        if (picked != null) _form.control(name).value = picked;
      },
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.calendar_today_outlined),
      ),
      valueAccessor: _DateAccessor(),
      validationMessages: {
        ValidationMessage.required: (_) => 'Required',
      },
    );
  }

  Widget _header(String t) => Text(t,
      style: Theme.of(context)
          .textTheme
          .titleLarge
          ?.copyWith(fontWeight: FontWeight.bold));

  Widget _emptyLines() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: const Center(
          child: Text('No lines added.',
              style: TextStyle(color: AppColours.textHint)),
        ),
      );
}

class _DateAccessor extends ControlValueAccessor<DateTime, String> {
  @override
  String modelToViewValue(DateTime? v) =>
      v != null ? FormatUtils.formatDate(v) : '';
  @override
  DateTime? viewToModelValue(String? v) => null;
}

class _PrlLineEntry {
  String itemCode = '';
  String itemDescription = '';
  String uomCode = '';
  double requestedQty = 1;
  double approxPrice = 0;

  Map<String, dynamic> toJson() => {
        'itemCode': itemCode,
        'itemDescription': itemDescription,
        'uomCode': uomCode,
        'requestedQty': requestedQty,
        'approxPrice': approxPrice,
      };
}

class _PrlLineForm extends StatefulWidget {
  const _PrlLineForm({
    super.key,
    required this.entry,
    required this.index,
    required this.onRemove,
  });
  final _PrlLineEntry entry;
  final int index;
  final VoidCallback onRemove;

  @override
  State<_PrlLineForm> createState() => _PrlLineFormState();
}

class _PrlLineFormState extends State<_PrlLineForm> {
  late final _codeCtrl  = TextEditingController(text: widget.entry.itemCode);
  late final _descCtrl  = TextEditingController(text: widget.entry.itemDescription);
  late final _uomCtrl   = TextEditingController(text: widget.entry.uomCode);
  late final _qtyCtrl   = TextEditingController(text: widget.entry.requestedQty.toString());
  late final _priceCtrl = TextEditingController(text: widget.entry.approxPrice.toString());

  @override
  void dispose() {
    for (final c in [_codeCtrl, _descCtrl, _uomCtrl, _qtyCtrl, _priceCtrl]) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColours.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColours.cardBorder),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('Line ${widget.index}',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, color: AppColours.primary)),
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.delete_outline,
                  color: AppColours.statusRejected, size: 20),
              onPressed: widget.onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ]),
          const SizedBox(height: 8),
          _tf(_codeCtrl, 'Item Code *', (v) => widget.entry.itemCode = v),
          const SizedBox(height: 8),
          _tf(_descCtrl, 'Description', (v) => widget.entry.itemDescription = v),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
                flex: 2,
                child: _tf(_qtyCtrl, 'Qty *', (v) => widget.entry.requestedQty = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(
                child: _tf(_uomCtrl, 'UOM', (v) => widget.entry.uomCode = v)),
            const SizedBox(width: 8),
            Expanded(
                flex: 2,
                child: _tf(_priceCtrl, 'Approx Price',
                    (v) => widget.entry.approxPrice = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
          ]),
        ]),
      );

  Widget _tf(TextEditingController c, String label, ValueChanged<String> onChange,
      {TextInputType? kt}) =>
      TextField(
        controller: c,
        keyboardType: kt,
        onChanged: onChange,
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColours.cardBorder)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide:
                  const BorderSide(color: AppColours.primary, width: 1.5)),
        ),
      );
}
