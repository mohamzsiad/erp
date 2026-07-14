import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/ai_chat/ui/screens/ai_chat_screen.dart';
import '../../features/approvals/ui/screens/approvals_screen.dart';
import '../../features/dashboard/ui/screens/dashboard_screen.dart';
import '../../features/finance/ap_invoices/ui/screens/ap_invoice_detail_screen.dart';
import '../../features/finance/ap_invoices/ui/screens/ap_invoice_list_screen.dart';
import '../../features/finance/ap_payments/ui/screens/ap_payment_detail_screen.dart';
import '../../features/finance/ap_payments/ui/screens/ap_payment_list_screen.dart';
import '../../features/finance/ar_invoices/ui/screens/ar_invoice_detail_screen.dart';
import '../../features/finance/ar_invoices/ui/screens/ar_invoice_list_screen.dart';
import '../../features/finance/budget/ui/screens/budget_screen.dart';
import '../../features/finance/journal_entries/ui/screens/journal_entry_detail_screen.dart';
import '../../features/finance/journal_entries/ui/screens/journal_entry_list_screen.dart';
import '../../features/inventory/grn/ui/screens/grn_detail_screen.dart';
import '../../features/inventory/grn/ui/screens/grn_form_screen.dart';
import '../../features/inventory/grn/ui/screens/grn_list_screen.dart';
import '../../features/inventory/items/ui/screens/item_detail_screen.dart';
import '../../features/inventory/items/ui/screens/item_list_screen.dart';
import '../../features/inventory/stock_issue/ui/screens/stock_issue_detail_screen.dart';
import '../../features/inventory/stock_issue/ui/screens/stock_issue_form_screen.dart';
import '../../features/inventory/stock_issue/ui/screens/stock_issue_list_screen.dart';
import '../../features/inventory/stock_summary/ui/screens/stock_summary_screen.dart';
import '../../features/notifications/ui/screens/notifications_screen.dart';
import '../../features/procurement/mrl/ui/screens/mrl_detail_screen.dart';
import '../../features/procurement/mrl/ui/screens/mrl_form_screen.dart';
import '../../features/procurement/mrl/ui/screens/mrl_list_screen.dart';
import '../../features/procurement/po/ui/screens/po_detail_screen.dart';
import '../../features/procurement/po/ui/screens/po_form_screen.dart';
import '../../features/procurement/po/ui/screens/po_list_screen.dart';
import '../../features/procurement/prl/ui/screens/prl_detail_screen.dart';
import '../../features/procurement/prl/ui/screens/prl_form_screen.dart';
import '../../features/procurement/prl/ui/screens/prl_list_screen.dart';
import '../../features/profile/ui/screens/profile_screen.dart';
import '../auth/auth_provider.dart';
import '../auth/auth_state.dart';
import '../widgets/bottom_nav.dart';
import 'route_names.dart';
import '../../features/auth/ui/screens/login_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authProvider.notifier);

  return GoRouter(
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isLoggedIn = authState.valueOrNull?.maybeWhen(
            authenticated: (_, __) => true,
            orElse: () => false,
          ) ??
          false;
      final isLoading = authState.isLoading ||
          (authState.valueOrNull?.maybeWhen(
                loading: () => true,
                orElse: () => false,
              ) ??
              false);

      if (isLoading) return null;

      final goingToLogin = state.matchedLocation == '/login';
      if (!isLoggedIn && !goingToLogin) return '/login';
      if (isLoggedIn && goingToLogin) return '/dashboard';
      return null;
    },
    refreshListenable: _AuthStateListenable(ref),
    routes: [
      GoRoute(
        path: '/login',
        name: RouteNames.login,
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) =>
            AppBottomNav(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            name: RouteNames.dashboard,
            builder: (_, __) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/approvals',
            name: RouteNames.approvals,
            builder: (_, __) => const ApprovalsScreen(),
          ),
          GoRoute(
            path: '/notifications',
            name: RouteNames.notifications,
            builder: (_, __) => const NotificationsScreen(),
          ),
          GoRoute(
            path: '/ai-chat',
            name: RouteNames.aiChat,
            builder: (_, __) => const AiChatScreen(),
          ),
          GoRoute(
            path: '/profile',
            name: RouteNames.profile,
            builder: (_, __) => const ProfileScreen(),
          ),
          // Procurement
          GoRoute(
            path: '/procurement/mrl',
            name: RouteNames.mrlList,
            builder: (_, __) => const MrlListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: RouteNames.mrlNew,
                builder: (_, __) => const MrlFormScreen(),
              ),
              GoRoute(
                path: ':id',
                name: RouteNames.mrlDetail,
                builder: (_, state) =>
                    MrlDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/procurement/prl',
            name: RouteNames.prlList,
            builder: (_, __) => const PrlListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: RouteNames.prlNew,
                builder: (_, __) => const PrlFormScreen(),
              ),
              GoRoute(
                path: ':id',
                name: RouteNames.prlDetail,
                builder: (_, state) =>
                    PrlDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/procurement/po',
            name: RouteNames.poList,
            builder: (_, __) => const PoListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: RouteNames.poNew,
                builder: (_, __) => const PoFormScreen(),
              ),
              GoRoute(
                path: ':id',
                name: RouteNames.poDetail,
                builder: (_, state) =>
                    PoDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          // Inventory
          GoRoute(
            path: '/inventory/items',
            name: RouteNames.itemList,
            builder: (_, __) => const ItemListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: RouteNames.itemDetail,
                builder: (_, state) =>
                    ItemDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/inventory/grn',
            name: RouteNames.grnList,
            builder: (_, __) => const GrnListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: RouteNames.grnNew,
                builder: (_, __) => const GrnFormScreen(),
              ),
              GoRoute(
                path: ':id',
                name: RouteNames.grnDetail,
                builder: (_, state) =>
                    GrnDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/inventory/issue',
            name: RouteNames.issueList,
            builder: (_, __) => const StockIssueListScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: RouteNames.issueNew,
                builder: (_, __) => const StockIssueFormScreen(),
              ),
              GoRoute(
                path: ':id',
                name: RouteNames.issueDetail,
                builder: (_, state) =>
                    StockIssueDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/inventory/stock',
            name: RouteNames.stockSummary,
            builder: (_, __) => const StockSummaryScreen(),
          ),
          // Finance
          GoRoute(
            path: '/finance/ap/invoices',
            name: RouteNames.apInvoiceList,
            builder: (_, __) => const ApInvoiceListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: RouteNames.apInvoiceDetail,
                builder: (_, state) =>
                    ApInvoiceDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/finance/ap/payments',
            name: RouteNames.apPaymentList,
            builder: (_, __) => const ApPaymentListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: RouteNames.apPaymentDetail,
                builder: (_, state) =>
                    ApPaymentDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/finance/ar/invoices',
            name: RouteNames.arInvoiceList,
            builder: (_, __) => const ArInvoiceListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: RouteNames.arInvoiceDetail,
                builder: (_, state) =>
                    ArInvoiceDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/finance/journals',
            name: RouteNames.journalList,
            builder: (_, __) => const JournalEntryListScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: RouteNames.journalDetail,
                builder: (_, state) =>
                    JournalEntryDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/finance/budgets',
            name: RouteNames.budgets,
            builder: (_, __) => const BudgetScreen(),
          ),
        ],
      ),
    ],
  );
});

/// Listens to auth state changes and notifies the router to re-evaluate guards.
class _AuthStateListenable extends ChangeNotifier {
  _AuthStateListenable(this._ref) {
    _ref.listen(authProvider, (_, __) => notifyListeners());
  }
  final Ref _ref;
}
