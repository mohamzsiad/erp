import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/confirm_dialog.dart';
import '../../data/models/mrl_models.dart';
import '../../data/repositories/mrl_repository.dart';
import '../../providers/mrl_provider.dart';

class MrlFormScreen extends ConsumerStatefulWidget {
  const MrlFormScreen({super.key});

  @override
  ConsumerState<MrlFormScreen> createState() => _MrlFormScreenState();
}

class _MrlFormScreenState extends ConsumerState<MrlFormScreen> {
  final _lines = <_LineEntry>[];
  bool _saving = false;

  late final FormGroup _form = FormGroup({
    'locationId':   FormControl<String>(validators: [Validators.required]),
    'chargeCodeId': FormControl<String>(),
    'docDate':      FormControl<DateTime>(value: DateTime.now(), validators: [Validators.required]),
    'deliveryDate': FormControl<DateTime>(),
    'remarks':      FormControl<String>(),
  });

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  void _addLine() {
    setState(() => _lines.add(_LineEntry()));
  }

  void _removeLine(int i) {
    setState(() => _lines.removeAt(i));
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
      title: 'Create MRL',
      message: 'Save this Material Requisition as draft?',
      confirmLabel: 'Save',
    );
    if (!ok || !context.mounted) return;

    setState(() => _saving = true);
    try {
      final payload = {
        'locationId':   _form.control('locationId').value,
        'chargeCodeId': _form.control('chargeCodeId').value,
        'docDate':      FormatUtils.toApiDate(
            _form.control('docDate').value as DateTime),
        'deliveryDate': _form.control('deliveryDate').value != null
            ? FormatUtils.toApiDate(
                _form.control('deliveryDate').value as DateTime)
            : null,
        'remarks': _form.control('remarks').value,
        'lines': _lines.map((l) => l.toJson()).toList(),
      };
      await ref.read(mrlRepositoryProvider).create(payload);
      ref.invalidate(mrlListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('MRL created successfully.'),
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
        title: const Text('New MRL'),
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
                    style: TextStyle(color: AppColours.surface,
                        fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: ReactiveForm(
        formGroup: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Header fields ──────────────────────────────────────────────
            _SectionTitle('Header'),
            const SizedBox(height: 8),
            ReactiveTextField<String>(
              formControlName: 'locationId',
              decoration: const InputDecoration(
                labelText: 'Location *',
                prefixIcon: Icon(Icons.location_on_outlined),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Location is required',
              },
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'chargeCodeId',
              decoration: const InputDecoration(
                labelText: 'Charge Code',
                prefixIcon: Icon(Icons.code),
              ),
            ),
            const SizedBox(height: 12),
            ReactiveDatePicker<DateTime>(
              formControlName: 'docDate',
              firstDate: DateTime(2020),
              lastDate: DateTime(2030),
              builder: (ctx, picker, child) => ReactiveTextField<DateTime>(
                formControlName: 'docDate',
                readOnly: true,
                onTap: () => picker.showPicker(),
                decoration: InputDecoration(
                  labelText: 'Document Date *',
                  prefixIcon: const Icon(Icons.calendar_today_outlined),
                  suffixIcon: const Icon(Icons.arrow_drop_down),
                  hintText: _form.control('docDate').value != null
                      ? FormatUtils.formatDate(
                          _form.control('docDate').value as DateTime)
                      : 'Select date',
                ),
                valueAccessor: DateTimeValueAccessor(
                    dateTimeFormat: FormatUtils.formatDate),
              ),
            ),
            const SizedBox(height: 12),
            ReactiveDatePicker<DateTime>(
              formControlName: 'deliveryDate',
              firstDate: DateTime.now(),
              lastDate: DateTime(2030),
              builder: (ctx, picker, child) => ReactiveTextField<DateTime>(
                formControlName: 'deliveryDate',
                readOnly: true,
                onTap: () => picker.showPicker(),
                decoration: InputDecoration(
                  labelText: 'Required Delivery Date',
                  prefixIcon: const Icon(Icons.event_outlined),
                  hintText: _form.control('deliveryDate').value != null
                      ? FormatUtils.formatDate(
                          _form.control('deliveryDate').value as DateTime)
                      : 'Select date',
                ),
                valueAccessor: DateTimeValueAccessor(
                    dateTimeFormat: FormatUtils.formatDate),
              ),
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'remarks',
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Remarks',
                alignLabelWithHint: true,
                prefixIcon: Padding(
                  padding: EdgeInsets.only(bottom: 40),
                  child: Icon(Icons.notes_outlined),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ── Lines ──────────────────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _SectionTitle('Line Items'),
                TextButton.icon(
                  onPressed: _addLine,
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
                  border: Border.all(
                      color: AppColours.cardBorder,
                      style: BorderStyle.solid),
                ),
                child: const Center(
                  child: Text('No lines added. Tap "+ Add Line".',
                      style: TextStyle(color: AppColours.textHint)),
                ),
              ),
            ...List.generate(
              _lines.length,
              (i) => _LineForm(
                key: ValueKey(i),
                entry: _lines[i],
                index: i + 1,
                onRemove: () => _removeLine(i),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _LineEntry {
  String itemCode = '';
  String itemDescription = '';
  String uomCode = '';
  double requestedQty = 1;
  double approxPrice = 0;

  Map<String, dynamic> toJson() => {
        'itemCode':        itemCode,
        'itemDescription': itemDescription,
        'uomCode':         uomCode,
        'requestedQty':    requestedQty,
        'approxPrice':     approxPrice,
      };
}

class _LineForm extends StatefulWidget {
  const _LineForm({
    super.key,
    required this.entry,
    required this.index,
    required this.onRemove,
  });
  final _LineEntry entry;
  final int index;
  final VoidCallback onRemove;

  @override
  State<_LineForm> createState() => _LineFormState();
}

class _LineFormState extends State<_LineForm> {
  late final _codeCtrl = TextEditingController(text: widget.entry.itemCode);
  late final _descCtrl = TextEditingController(text: widget.entry.itemDescription);
  late final _uomCtrl  = TextEditingController(text: widget.entry.uomCode);
  late final _qtyCtrl  = TextEditingController(
      text: widget.entry.requestedQty.toString());
  late final _priceCtrl = TextEditingController(
      text: widget.entry.approxPrice.toString());

  @override
  void dispose() {
    for (final c in [_codeCtrl, _descCtrl, _uomCtrl, _qtyCtrl, _priceCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColours.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Line ${widget.index}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColours.primary)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.delete_outline,
                    color: AppColours.statusRejected),
                onPressed: widget.onRemove,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _Field(
            controller: _codeCtrl,
            label: 'Item Code *',
            onChanged: (v) => widget.entry.itemCode = v,
          ),
          const SizedBox(height: 8),
          _Field(
            controller: _descCtrl,
            label: 'Description',
            onChanged: (v) => widget.entry.itemDescription = v,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: _Field(
                  controller: _qtyCtrl,
                  label: 'Qty *',
                  keyboardType: TextInputType.number,
                  onChanged: (v) =>
                      widget.entry.requestedQty = double.tryParse(v) ?? 0,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Field(
                  controller: _uomCtrl,
                  label: 'UOM',
                  onChanged: (v) => widget.entry.uomCode = v,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: _Field(
                  controller: _priceCtrl,
                  label: 'Approx Price',
                  keyboardType: TextInputType.number,
                  onChanged: (v) =>
                      widget.entry.approxPrice = double.tryParse(v) ?? 0,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.onChanged,
    this.keyboardType,
  });
  final TextEditingController controller;
  final String label;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        keyboardType: keyboardType,
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder:
              OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColours.cardBorder)),
          focusedBorder:
              OutlineInputBorder(borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColours.primary, width: 1.5)),
          isDense: true,
        ),
      );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Text(
        title,
        style: Theme.of(context)
            .textTheme
            .titleLarge
            ?.copyWith(fontWeight: FontWeight.bold),
      );
}

/// Simple value accessor for DateTime form controls.
class DateTimeValueAccessor extends ControlValueAccessor<DateTime, String> {
  DateTimeValueAccessor({required this.dateTimeFormat});
  final String Function(DateTime?) dateTimeFormat;

  @override
  String modelToViewValue(DateTime? modelValue) =>
      modelValue != null ? dateTimeFormat(modelValue) : '';

  @override
  DateTime? viewToModelValue(String? viewValue) => null;
}
