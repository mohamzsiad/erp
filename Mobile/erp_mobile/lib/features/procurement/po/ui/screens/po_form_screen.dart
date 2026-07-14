import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/confirm_dialog.dart';
import '../../data/repositories/po_repository.dart';
import '../../providers/po_provider.dart';

class PoFormScreen extends ConsumerStatefulWidget {
  const PoFormScreen({super.key});

  @override
  ConsumerState<PoFormScreen> createState() => _PoFormScreenState();
}

class _PoFormScreenState extends ConsumerState<PoFormScreen> {
  final _lines = <_PoLineEntry>[];
  bool _saving = false;

  late final FormGroup _form = FormGroup({
    'supplierId':   FormControl<String>(validators: [Validators.required]),
    'currencyId':   FormControl<String>(),
    'paymentTerms': FormControl<String>(),
    'docDate':      FormControl<DateTime>(value: DateTime.now(), validators: [Validators.required]),
    'deliveryDate': FormControl<DateTime>(),
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
        content: Text('Add at least one line.'),
        backgroundColor: AppColours.statusPartial,
      ));
      return;
    }
    final ok = await ConfirmDialog.show(
      context,
      title: 'Create Purchase Order',
      message: 'Save as draft?',
      confirmLabel: 'Save',
    );
    if (!ok || !context.mounted) return;

    setState(() => _saving = true);
    try {
      await ref.read(poRepositoryProvider).create({
        'supplierId':   _form.control('supplierId').value,
        'currencyId':   _form.control('currencyId').value,
        'paymentTerms': _form.control('paymentTerms').value,
        'docDate':      FormatUtils.toApiDate(
            _form.control('docDate').value as DateTime),
        'deliveryDate': _form.control('deliveryDate').value != null
            ? FormatUtils.toApiDate(
                _form.control('deliveryDate').value as DateTime)
            : null,
        'remarks': _form.control('remarks').value,
        'lines':   _lines.map((l) => l.toJson()).toList(),
      });
      ref.invalidate(poListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('PO created successfully.'),
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
        title: const Text('New Purchase Order'),
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
            _sectionTitle('Header'),
            const SizedBox(height: 8),
            ReactiveTextField<String>(
              formControlName: 'supplierId',
              decoration: const InputDecoration(
                labelText: 'Supplier *',
                prefixIcon: Icon(Icons.business_outlined),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Supplier is required',
              },
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'currencyId',
              decoration: const InputDecoration(
                labelText: 'Currency',
                prefixIcon: Icon(Icons.currency_exchange),
              ),
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'paymentTerms',
              decoration: const InputDecoration(
                labelText: 'Payment Terms',
                prefixIcon: Icon(Icons.payment_outlined),
              ),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _datePicker('docDate', 'Doc Date *')),
              const SizedBox(width: 12),
              Expanded(child: _datePicker('deliveryDate', 'Delivery Date')),
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
                _sectionTitle('Lines'),
                TextButton.icon(
                  onPressed: () =>
                      setState(() => _lines.add(_PoLineEntry())),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add Line'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_lines.isEmpty)
              Container(
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
              ),
            ...List.generate(
              _lines.length,
              (i) => _PoLineForm(
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

  Widget _datePicker(String name, String label) =>
      ReactiveTextField<DateTime>(
        formControlName: name,
        readOnly: true,
        onTap: () async {
          final picked = await showDatePicker(
            context: context,
            initialDate:
                (_form.control(name).value as DateTime?) ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime(2030),
          );
          if (picked != null) _form.control(name).value = picked;
        },
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.calendar_today_outlined),
        ),
        valueAccessor: _DateAcc(),
        validationMessages: {
          ValidationMessage.required: (_) => 'Required',
        },
      );

  Widget _sectionTitle(String t) => Text(t,
      style: Theme.of(context)
          .textTheme
          .titleLarge
          ?.copyWith(fontWeight: FontWeight.bold));
}

class _DateAcc extends ControlValueAccessor<DateTime, String> {
  @override
  String modelToViewValue(DateTime? v) =>
      v != null ? FormatUtils.formatDate(v) : '';
  @override
  DateTime? viewToModelValue(String? v) => null;
}

class _PoLineEntry {
  String itemCode = '';
  String itemDescription = '';
  String uomCode = '';
  String chargeCodeId = '';
  double orderedQty = 1;
  double unitPrice = 0;
  double discountPct = 0;
  double taxPct = 0;

  Map<String, dynamic> toJson() => {
        'itemCode': itemCode,
        'itemDescription': itemDescription,
        'uomCode': uomCode,
        'chargeCodeId': chargeCodeId,
        'orderedQty': orderedQty,
        'unitPrice': unitPrice,
        'discountPct': discountPct,
        'taxPct': taxPct,
      };
}

class _PoLineForm extends StatefulWidget {
  const _PoLineForm({
    super.key,
    required this.entry,
    required this.index,
    required this.onRemove,
  });
  final _PoLineEntry entry;
  final int index;
  final VoidCallback onRemove;

  @override
  State<_PoLineForm> createState() => _PoLineFormState();
}

class _PoLineFormState extends State<_PoLineForm> {
  late final _codeCtrl     = TextEditingController(text: widget.entry.itemCode);
  late final _descCtrl     = TextEditingController(text: widget.entry.itemDescription);
  late final _uomCtrl      = TextEditingController(text: widget.entry.uomCode);
  late final _ccCtrl       = TextEditingController(text: widget.entry.chargeCodeId);
  late final _qtyCtrl      = TextEditingController(text: widget.entry.orderedQty.toString());
  late final _priceCtrl    = TextEditingController(text: widget.entry.unitPrice.toString());
  late final _discCtrl     = TextEditingController(text: widget.entry.discountPct.toString());
  late final _taxCtrl      = TextEditingController(text: widget.entry.taxPct.toString());

  @override
  void dispose() {
    for (final c in [_codeCtrl, _descCtrl, _uomCtrl, _ccCtrl,
        _qtyCtrl, _priceCtrl, _discCtrl, _taxCtrl]) {
      c.dispose();
    }
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
                child: _tf(_qtyCtrl, 'Qty *',
                    (v) => widget.entry.orderedQty = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(
                child: _tf(_uomCtrl, 'UOM', (v) => widget.entry.uomCode = v)),
            const SizedBox(width: 8),
            Expanded(
                flex: 2,
                child: _tf(_priceCtrl, 'Unit Price *',
                    (v) => widget.entry.unitPrice = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
                child: _tf(_discCtrl, 'Disc %',
                    (v) => widget.entry.discountPct = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(
                child: _tf(_taxCtrl, 'Tax %',
                    (v) => widget.entry.taxPct = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(
                flex: 2,
                child: _tf(_ccCtrl, 'Charge Code',
                    (v) => widget.entry.chargeCodeId = v)),
          ]),
        ]),
      );

  Widget _tf(TextEditingController c, String label, ValueChanged<String> fn,
      {TextInputType? kt}) =>
      TextField(
        controller: c,
        keyboardType: kt,
        onChanged: fn,
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
