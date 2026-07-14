import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../../core/theme/app_colours.dart';
import '../../../../../core/utils/format_utils.dart';
import '../../../../../core/widgets/confirm_dialog.dart';
import '../../data/repositories/stock_issue_repository.dart';
import '../../providers/stock_issue_provider.dart';

class StockIssueFormScreen extends ConsumerStatefulWidget {
  const StockIssueFormScreen({super.key});

  @override
  ConsumerState<StockIssueFormScreen> createState() =>
      _StockIssueFormScreenState();
}

class _StockIssueFormScreenState
    extends ConsumerState<StockIssueFormScreen> {
  final _lines = <_SILineEntry>[];
  bool _saving = false;

  late final FormGroup _form = FormGroup({
    'warehouseId':  FormControl<String>(validators: [Validators.required]),
    'issuedToId':   FormControl<String>(validators: [Validators.required]),
    'issueType':    FormControl<String>(validators: [Validators.required]),
    'docDate':      FormControl<DateTime>(value: DateTime.now(), validators: [Validators.required]),
    'projectId':    FormControl<String>(),
    'chargeCodeId': FormControl<String>(),
    'remarks':      FormControl<String>(),
  });

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_form.invalid) { _form.markAllAsTouched(); return; }
    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Add at least one line item.'),
        backgroundColor: AppColours.statusPartial,
      ));
      return;
    }
    final ok = await ConfirmDialog.show(context,
        title: 'Create Stock Issue', message: 'Save as draft?',
        confirmLabel: 'Save');
    if (!ok || !context.mounted) return;

    setState(() => _saving = true);
    try {
      await ref.read(stockIssueRepositoryProvider).create({
        'warehouseId':  _form.control('warehouseId').value,
        'issuedToId':   _form.control('issuedToId').value,
        'issueType':    _form.control('issueType').value,
        'docDate':      FormatUtils.toApiDate(_form.control('docDate').value as DateTime),
        'projectId':    _form.control('projectId').value,
        'chargeCodeId': _form.control('chargeCodeId').value,
        'remarks':      _form.control('remarks').value,
        'lines':        _lines.map((l) => l.toJson()).toList(),
      });
      ref.invalidate(stockIssueListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Stock issue created successfully.'),
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
        title: const Text('New Stock Issue'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 20, height: 20,
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
            _section('Header'),
            const SizedBox(height: 8),
            ReactiveTextField<String>(
              formControlName: 'warehouseId',
              decoration: const InputDecoration(
                  labelText: 'Warehouse *',
                  prefixIcon: Icon(Icons.warehouse_outlined)),
              validationMessages: {ValidationMessage.required: (_) => 'Required'},
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'issuedToId',
              decoration: const InputDecoration(
                  labelText: 'Issued To *',
                  prefixIcon: Icon(Icons.person_outlined)),
              validationMessages: {ValidationMessage.required: (_) => 'Required'},
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'issueType',
              decoration: const InputDecoration(
                  labelText: 'Issue Type *',
                  prefixIcon: Icon(Icons.category_outlined)),
              validationMessages: {ValidationMessage.required: (_) => 'Required'},
            ),
            const SizedBox(height: 12),
            _datePicker('docDate', 'Doc Date *'),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'projectId',
              decoration: const InputDecoration(
                  labelText: 'Project (optional)',
                  prefixIcon: Icon(Icons.work_outline)),
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'chargeCodeId',
              decoration: const InputDecoration(
                  labelText: 'Charge Code (optional)',
                  prefixIcon: Icon(Icons.code)),
            ),
            const SizedBox(height: 12),
            ReactiveTextField<String>(
              formControlName: 'remarks',
              maxLines: 3,
              decoration: const InputDecoration(
                  labelText: 'Remarks', alignLabelWithHint: true),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _section('Lines'),
                TextButton.icon(
                  onPressed: () =>
                      setState(() => _lines.add(_SILineEntry())),
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
            ...List.generate(_lines.length,
              (i) => _SILineForm(
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
            prefixIcon: const Icon(Icons.calendar_today_outlined)),
        valueAccessor: _DateAcc(),
        validationMessages: {ValidationMessage.required: (_) => 'Required'},
      );

  Widget _section(String t) => Text(t,
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

class _SILineEntry {
  String itemCode = '';
  String itemDescription = '';
  String uomCode = '';
  double requestedQty = 1;
  String lotNo = '';

  Map<String, dynamic> toJson() => {
        'itemCode': itemCode,
        'itemDescription': itemDescription,
        'uomCode': uomCode,
        'requestedQty': requestedQty,
        if (lotNo.isNotEmpty) 'lotNo': lotNo,
      };
}

class _SILineForm extends StatefulWidget {
  const _SILineForm({
    super.key, required this.entry, required this.index,
    required this.onRemove,
  });
  final _SILineEntry entry;
  final int index;
  final VoidCallback onRemove;
  @override
  State<_SILineForm> createState() => _SILineFormState();
}

class _SILineFormState extends State<_SILineForm> {
  late final _codeCtrl  = TextEditingController(text: widget.entry.itemCode);
  late final _descCtrl  = TextEditingController(text: widget.entry.itemDescription);
  late final _uomCtrl   = TextEditingController(text: widget.entry.uomCode);
  late final _qtyCtrl   = TextEditingController(text: widget.entry.requestedQty.toString());
  late final _lotCtrl   = TextEditingController(text: widget.entry.lotNo);

  @override
  void dispose() {
    for (final c in [_codeCtrl, _descCtrl, _uomCtrl, _qtyCtrl, _lotCtrl]) {
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
                child: _tf(_qtyCtrl, 'Qty *',
                    (v) => widget.entry.requestedQty = double.tryParse(v) ?? 0,
                    kt: TextInputType.number)),
            const SizedBox(width: 8),
            Expanded(child: _tf(_uomCtrl, 'UOM', (v) => widget.entry.uomCode = v)),
            const SizedBox(width: 8),
            Expanded(flex: 2,
                child: _tf(_lotCtrl, 'Lot No.', (v) => widget.entry.lotNo = v)),
          ]),
        ]),
      );

  Widget _tf(TextEditingController c, String label, ValueChanged<String> fn,
      {TextInputType? kt}) =>
      TextField(
        controller: c, keyboardType: kt, onChanged: fn,
        decoration: InputDecoration(
          labelText: label, isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColours.cardBorder)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColours.primary, width: 1.5)),
        ),
      );
}
