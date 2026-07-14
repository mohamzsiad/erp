import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:reactive_forms/reactive_forms.dart';

import '../../../../core/auth/auth_provider.dart';
import '../../../../core/models/app_exception.dart';
import '../../../../core/theme/app_colours.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = FormGroup({
    'email': FormControl<String>(
      value: '',
      validators: [Validators.required, Validators.email],
    ),
    'password': FormControl<String>(
      value: '',
      validators: [Validators.required, Validators.minLength(4)],
    ),
  });

  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (_form.invalid) {
      _form.markAllAsTouched();
      return;
    }
    setState(() => _isLoading = true);
    try {
      final email    = _form.control('email').value as String;
      final password = _form.control('password').value as String;
      await ref.read(authProvider.notifier).login(email.trim(), password);
    } on AppException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColours.statusRejected,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('An unexpected error occurred. Please try again.'),
            backgroundColor: AppColours.statusRejected,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Watch auth errors (e.g. wrong credentials from notifier)
    ref.listen(authProvider, (_, next) {
      next.whenOrNull(
        error: (e, _) {
          final msg = e is AppException ? e.message : 'Login failed.';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(msg),
              backgroundColor: AppColours.statusRejected,
            ),
          );
        },
      );
    });

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColours.primary, AppColours.primaryLight],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: _LoginCard(
                form: _form,
                isLoading: _isLoading,
                obscurePassword: _obscurePassword,
                onTogglePassword: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                onSignIn: _signIn,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.form,
    required this.isLoading,
    required this.obscurePassword,
    required this.onTogglePassword,
    required this.onSignIn,
  });

  final FormGroup form;
  final bool isLoading;
  final bool obscurePassword;
  final VoidCallback onTogglePassword;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ReactiveForm(
        formGroup: form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Logo
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColours.primary,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(
                Icons.business,
                color: AppColours.surface,
                size: 40,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'CloudERP',
              style: tt.headlineLarge?.copyWith(
                color: AppColours.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Al Wadi Construction LLC',
              style: tt.bodyMedium?.copyWith(color: AppColours.textSecondary),
            ),
            const SizedBox(height: 32),

            // Email
            ReactiveTextField<String>(
              formControlName: 'email',
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Email address',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Email is required',
                ValidationMessage.email: (_) => 'Enter a valid email',
              },
            ),
            const SizedBox(height: 16),

            // Password
            ReactiveTextField<String>(
              formControlName: 'password',
              obscureText: obscurePassword,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => onSignIn(),
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  icon: Icon(
                    obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                  onPressed: onTogglePassword,
                ),
              ),
              validationMessages: {
                ValidationMessage.required: (_) => 'Password is required',
                ValidationMessage.minLength: (_) => 'Password is too short',
              },
            ),
            const SizedBox(height: 28),

            // Sign In button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: isLoading ? null : onSignIn,
                child: isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          color: AppColours.surface,
                          strokeWidth: 2.5,
                        ),
                      )
                    : const Text('Sign In'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
