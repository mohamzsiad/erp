import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/confirm_dialog.dart';
import '../../data/repositories/grn_repository.dart';
import '../../providers/grn_provider.dart';

class GrnFormScreen extends ConsumerStatefulWidget {
  const GrnFormScreen({super.key});

  @override
  ConsumerState<GrnFormScreen> createState() => _GrnFormScreenState();
}

class _GrnFormScreenState extends ConsumerState<GrnFormScreen> {
  final _lines = <_GrnLineEntry>[];
  bool _saving = false;

  late final FormGroup _form = FormGroup({
    'supplierId':    FormControl<String>(validators: [Validators.required]),
    'warehouseId':   FormControl<String>(validators: [Validators.required]),
    'docDate':       FormControl<DateTime>(value: DateTime.now(), validators: [Validators.required]),
    'poId':          FormControl<String>(),
    'deliveryNoteNo': FormControl<String>(),
    'remarks':       FormControl<String>(),
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
      title: 'Create GRN',
      message: 'Save as draft?',
      confirmLabel: 'Save',
    );
    if (!ok || !context.mounted) return;

    setState(() => _saving = true);
    try {
      await ref.read(grnRepositoryProvider).create({
        'supplierId':    _form.control('supplierId').value,
        'warehouseId':   _form.control('warehouseId').value,
        'docDate':       FormatUtils.toApiDate(
            _form.control('docDate').value as DateTime),
        'poId':          _form.control('poId').value,
        'deliveryNoteNo': _form.control('deliveryNoteNo').value,
        'remarks':       _form.control('remarks').value,
        'lines':         _lines.map((l) => l.toJson()).toList(),
      });
      ref.invalidate(grnListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('GRN created successfully.'),
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
        title: const Text('New GRN'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20, height: 20,
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
            _title('Header'),
            const SizedBox(height: 8),
            ReactiveTextField<String>(
              formControlName: 'supplierId',
              decoration: const InputDecoration(
                labelText: 'Supplier *',
                prefixIcon: Icon(Icons.business_outlined),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Required',
              },
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'warehouseId',
              decoration: const InputDecoration(
                labelText: 'Warehouse *',
                prefixIcon: Icon(Icons.warehouse_outlined),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Required',
              },
            ),
            const SizedBox(height: 12),
            _datePicker('docDate', 'Doc Date *'),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'poId',
              decoration: const InputDecoration(
                labelText: 'PO Reference (optional)',
                prefixIcon: Icon(Icons.link_outlined),
              ),
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'deliveryNoteNo',
              decoration: const InputDecoration(
                labelText: 'Delivery Note No.',
                prefixIcon: Icon(Icons.note_outlined),
              ),
            ),
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
                _title('Lines'),
                TextButton.icon(
                  onPressed: () =>
                      setState(() => _lines.add(_GrnLineEntry())),
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
              (i) => _GrnLineForm(
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

  Widget _title(String t) => Text(t,
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

class _GrnLineEntry {
  String itemCode = '';
  String itemDescription = '';
  String uomCode = '';
  double receivedQty = 1;
  double acceptedQty = 1;
  double rejectedQty = 0;
  double unitPrice = 0;
  String lotNo = '';
  String serialNo = '';

  Map<String, dynamic> toJson() => {
        'itemCode': itemCode,
        'itemDescription': itemDescription,
        'uomCode': uomCode,
        'receivedQty': receivedQty,
        'acceptedQty': acceptedQty,
        'rejectedQty': rejectedQty,
        'unitPrice': unitPrice,
        if (lotNo.isNotEmpty) 'lotNo': lotNo,
        if (serialNo.isNotEmpty) 'serialNo': serialNo,
      };
}

class _GrnLineForm extends StatefulWidget {
  const _GrnLineForm({
    super.key,
    required this.entry,
    required this.index,
    required this.onRemove,
  });
  final _GrnLineEntry entry;
  final int index;
  final VoidCallback onRemove;

  @override
  State<_GrnLineForm> createState() => _GrnLineFormState();
}

class _GrnLineFormState extends State<_GrnLineForm> {
  late final _codeCtrl    = TextEditingController(text: widget.entry.itemCode);
  late final _descCtrl    = TextEditingController(text: widget.entry.itemDescription);
  late final _uomCtrl     = TextEditingController(text: widget.entry.uomCode);
  late final _rcvdCtrl    = TextEditingController(text: widget.entry.receivedQty.toString());
  late final _accCtrl     = TextEditingController(text: widget.entry.acceptedQty.toString());
  late final _rejCtrl     = TextEditingController(text: widget.entry.rejectedQty.toString());
  late final _priceCtrl   = TextEditingController(text: widget.entry.unitPrice.toString());
  late final _lotCtrl     = TextEditingController(text: widget.entry.lotNo);
  late final _serialCtrl  = TextEditingController(text: widget.entry.serialNo);

  @override
  void dispose() {
    for (final c in [_codeCtrl, _descCtrl, _uomCtrl, _rcvdCtrl,
        _accCtrl, _rejCtrl, _priceCtrl, _lotCtrl, _serialCtrl]) {
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
            Expanded(flex: 2,
                child: _tf(_rcvdCtrl, 'Received Qty *',
                    (v) => widget.entry.receivedQty = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(child: _tf(_uomCtrl, 'UOM', (v) => widget.entry.uomCode = v)),
            const SizedBox(width: 8),
            Expanded(flex: 2,
                child: _tf(_priceCtrl, 'Unit Price',
                    (v) => widget.entry.unitPrice = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
                child: _tf(_accCtrl, 'Accepted Qty',
                    (v) => widget.entry.acceptedQty = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(
                child: _tf(_rejCtrl, 'Rejected Qty',
                    (v) => widget.entry.rejectedQty = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
                child: _tf(_lotCtrl, 'Lot No.',
                    (v) => widget.entry.lotNo = v)),
            const SizedBox(width: 8),
            Expanded(
                child: _tf(_serialCtrl, 'Serial No.',
                    (v) => widget.entry.serialNo = v)),
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
