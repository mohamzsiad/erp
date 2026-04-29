import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { useModuleStore } from '../store/moduleStore';
import { useUiStore } from '../store/uiStore';
import { Toast } from '../components/ui/Toast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const setModules = useModuleStore((s) => s.setModules);
  const addToast = useUiStore((s) => s.addToast);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    defaultValues: { email: '' },
  });

  const validate = (data: LoginFormData): string | null => {
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      return parsed.error.errors[0]?.message ?? 'Validation failed';
    }
    return null;
  };

  const onSubmit = async (data: LoginFormData) => {
    const validationError = validate(data);
    if (validationError) {
      addToast({ type: 'error', title: 'Validation Error', message: validationError });
      return;
    }

    try {
      const result = await authApi.login({
        email: data.email,
        password: data.password,
      });
      setAuth(result.user, result.accessToken, result.refreshToken, result.permissions);
      setModules(result.user.enabledModules as string[]);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed. Please check your credentials.';
      addToast({ type: 'error', title: 'Login Failed', message: msg });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F4E79] to-[#2E75B6] flex items-center justify-center p-4">
      <Toast />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-[#1F4E79] rounded-t-2xl px-8 py-6 text-white text-center">
          <h1 className="text-2xl font-bold tracking-wide">CloudERP</h1>
          <p className="text-blue-200 text-sm mt-1">Enterprise Resource Planning</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-8 py-8 space-y-5">
          <h2 className="text-gray-700 font-semibold text-lg text-center">Sign in to your account</h2>

          {/* Email */}
          <div>
            <label className="erp-label">Email Address</label>
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className="erp-input mt-1"
              placeholder="admin@demo.com"
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="erp-label">Password</label>
            <div className="relative mt-1">
              <input
                {...register('password', { required: 'Password is required' })}
                type={showPassword ? 'text' : 'password'}
                className="erp-input pr-10"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-[#1F4E79] hover:bg-[#163D5F] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogIn size={18} />
            )}
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="px-8 pb-6 text-center">
          <p className="text-gray-400 text-xs">
            © {new Date().getFullYear()} CloudERP. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
