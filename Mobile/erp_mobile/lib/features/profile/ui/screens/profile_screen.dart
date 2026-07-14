import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../core/auth/auth_provider.dart';
import '../../../../core/auth/models/auth_user.dart';
import '../../../../core/models/app_exception.dart';
import '../../../../core/theme/app_colours.dart';
import '../../../../core/utils/format_utils.dart';
import '../../../../core/widgets/confirm_dialog.dart';
import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_constants.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = ref.watch(authUserProvider);

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
      ),
      body: authState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : user == null
              ? const Center(child: Text('Not signed in'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      const SizedBox(height: 12),
                      _AvatarSection(user: user),
                      const SizedBox(height: 24),
                      _InfoCard(user: user),
                      const SizedBox(height: 16),
                      _ModulesCard(user: user),
                      const SizedBox(height: 24),
                      _ChangePasswordButton(user: user),
                      const SizedBox(height: 12),
                      _SignOutButton(),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────
class _AvatarSection extends StatelessWidget {
  const _AvatarSection({required this.user});
  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    final initials = FormatUtils.initials('${user.firstName} ${user.lastName}');
    return Column(
      children: [
        CircleAvatar(
          radius: 42,
          backgroundColor: AppColours.primary,
          child: Text(
            initials,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AppColours.surface,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          '${user.firstName} ${user.lastName}',
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          user.email,
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: AppColours.textSecondary),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: AppColours.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            user.roleName,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColours.primary,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Info Card ─────────────────────────────────────────────────────────────────
class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.user});
  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    return _Card(
      children: [
        _InfoRow(label: 'Company', value: 'Al Wadi Construction LLC'),
        const Divider(height: 1),
        _InfoRow(label: 'Role', value: user.roleName),
        const Divider(height: 1),
        _InfoRow(label: 'User ID', value: user.id),
      ],
    );
  }
}

// ── Modules Card ──────────────────────────────────────────────────────────────
class _ModulesCard extends StatelessWidget {
  const _ModulesCard({required this.user});
  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    if (user.enabledModules.isEmpty) return const SizedBox.shrink();

    return _Card(
      children: [
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Enabled Modules',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: user.enabledModules
                    .map((m) => Chip(
                          label: Text(m,
                              style: const TextStyle(fontSize: 12)),
                          backgroundColor: AppColours.kpiBlue,
                          side: BorderSide.none,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                        ))
                    .toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Change Password ───────────────────────────────────────────────────────────
class _ChangePasswordButton extends ConsumerWidget {
  const _ChangePasswordButton({required this.user});
  final AuthUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => _showChangePasswordSheet(context, ref),
        icon: const Icon(Icons.lock_outline),
        label: const Text('Change Password'),
      ),
    );
  }

  void _showChangePasswordSheet(BuildContext context, WidgetRef ref) {
    final form = FormGroup({
      'current':  FormControl<String>(validators: [Validators.required]),
      'newPass':  FormControl<String>(validators: [
        Validators.required,
        Validators.minLength(8),
      ]),
      'confirm':  FormControl<String>(validators: [Validators.required]),
    }, validators: [
      _mustMatch('newPass', 'confirm'),
    ]);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: _ChangePasswordForm(form: form, ref: ref),
      ),
    );
  }

  ValidatorFunction _mustMatch(String control, String matching) =>
      (group) {
        final g = group as FormGroup;
        final newVal = g.control(control).value as String?;
        final confVal = g.control(matching).value as String?;
        if (newVal != confVal) {
          g.control(matching).setErrors({'mustMatch': true});
        } else {
          g.control(matching).removeError('mustMatch');
        }
        return null;
      };
}

class _ChangePasswordForm extends ConsumerStatefulWidget {
  const _ChangePasswordForm({required this.form, required this.ref});
  final FormGroup form;
  final WidgetRef ref;

  @override
  ConsumerState<_ChangePasswordForm> createState() =>
      _ChangePasswordFormState();
}

class _ChangePasswordFormState extends ConsumerState<_ChangePasswordForm> {
  bool _loading = false;
  bool _showCurrent  = false;
  bool _showNew      = false;
  bool _showConfirm  = false;

  @override
  Widget build(BuildContext context) {
    return ReactiveForm(
      formGroup: widget.form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Change Password',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 20),
          ReactiveTextField<String>(
            formControlName: 'current',
            obscureText: !_showCurrent,
            decoration: InputDecoration(
              labelText: 'Current password',
              suffixIcon: IconButton(
                icon: Icon(_showCurrent
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined),
                onPressed: () =>
                    setState(() => _showCurrent = !_showCurrent),
              ),
            ),
            validationMessages: {
              ValidationMessage.required: (_) => 'Required',
            },
          ),
          const SizedBox(height: 14),
          ReactiveTextField<String>(
            formControlName: 'newPass',
            obscureText: !_showNew,
            decoration: InputDecoration(
              labelText: 'New password',
              suffixIcon: IconButton(
                icon: Icon(_showNew
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined),
                onPressed: () => setState(() => _showNew = !_showNew),
              ),
            ),
            validationMessages: {
              ValidationMessage.required: (_) => 'Required',
              ValidationMessage.minLength: (_) =>
                  'Minimum 8 characters',
            },
          ),
          const SizedBox(height: 14),
          ReactiveTextField<String>(
            formControlName: 'confirm',
            obscureText: !_showConfirm,
            decoration: InputDecoration(
              labelText: 'Confirm new password',
              suffixIcon: IconButton(
                icon: Icon(_showConfirm
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined),
                onPressed: () =>
                    setState(() => _showConfirm = !_showConfirm),
              ),
            ),
            validationMessages: {
              ValidationMessage.required: (_) => 'Required',
              'mustMatch': (_) => 'Passwords do not match',
            },
          ),
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Update Password'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (widget.form.invalid) {
      widget.form.markAllAsTouched();
      return;
    }
    setState(() => _loading = true);
    try {
      final dio = ref.read(apiClientProvider);
      await dio.post('/auth/change-password', data: {
        'currentPassword': widget.form.control('current').value,
        'newPassword':     widget.form.control('newPass').value,
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Password updated successfully.'),
            backgroundColor: AppColours.statusApproved,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException ? e.message : e.toString()),
            backgroundColor: AppColours.statusRejected,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

// ── Sign Out ──────────────────────────────────────────────────────────────────
class _SignOutButton extends ConsumerWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColours.statusRejected,
        ),
        onPressed: () async {
          final confirmed = await ConfirmDialog.show(
            context,
            title: 'Sign Out',
            message: 'Are you sure you want to sign out?',
            confirmLabel: 'Sign Out',
            isDestructive: true,
          );
          if (confirmed) {
            await ref.read(authProvider.notifier).logout();
          }
        },
        icon: const Icon(Icons.logout),
        label: const Text('Sign Out'),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColours.cardBorder),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(label,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColours.textSecondary)),
          ),
          Expanded(
            child: Text(value,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
