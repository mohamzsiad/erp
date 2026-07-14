/// API configuration constants.
///
/// HOW TO CHANGE BASE URL:
/// • Local development with Android emulator → use 'http://10.0.2.2:3000/api/v1'
/// • Local development with iOS simulator   → use 'http://127.0.0.1:3000/api/v1'
/// • Physical device on same Wi-Fi          → use your machine's LAN IP, e.g. 'http://192.168.1.100:3000/api/v1'
/// • Production                             → replace with your hosted URL, e.g. 'https://erp.alwadi.com/api/v1'
class ApiConstants {
  ApiConstants._();

  // ─── Change this value to switch environments ────────────────────────────
  static const String baseUrl = 'http://10.0.2.2:3000/api/v1';
  // ─────────────────────────────────────────────────────────────────────────

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Auth
  static const String login       = '/auth/login';
  static const String logout      = '/auth/logout';
  static const String refresh     = '/auth/refresh';
  static const String userProfile = '/auth/profile';

  // Dashboard
  static const String dashboardKpis           = '/dashboard/kpis';
  static const String dashboardWorkflowTasks  = '/dashboard/workflow-tasks';

  // Workflow / Approvals
  static const String workflowMyTasks = '/workflow/my-tasks';
  static const String workflowAction  = '/workflow/approve';

  // Procurement
  static const String mrl = '/procurement/mrl';
  static const String prl = '/procurement/prl';
  static const String po  = '/procurement/po';

  // Inventory
  static const String inventoryItems        = '/inventory/items';
  static const String inventoryGrn          = '/inventory/grn';
  static const String inventoryIssue        = '/inventory/issue';
  static const String inventoryStockSummary = '/inventory/stock-summary';
  // Aliases used by feature repositories
  static const String items        = inventoryItems;
  static const String grn          = inventoryGrn;
  static const String stockIssues  = inventoryIssue;
  static const String stockSummary = inventoryStockSummary;

  // Finance
  static const String financeApInvoices  = '/finance/ap/invoices';
  static const String financeApPayments  = '/finance/ap/payments';
  static const String financeArInvoices  = '/finance/ar/invoices';
  static const String financeJournals    = '/finance/journals';
  static const String financeBudgets     = '/finance/budgets/vs-actual';
  // Aliases used by feature repositories
  static const String apInvoices     = financeApInvoices;
  static const String apPayments     = financeApPayments;
  static const String arInvoices     = financeArInvoices;
  static const String journalEntries = financeJournals;
  static const String budgetVsActual = financeBudgets;

  // Notifications
  static const String notifications          = '/notifications';
  static const String notificationsUnreadCount = '/notifications/unread-count';
  static const String notificationsMarkAllRead = '/notifications/mark-all-read';

  // AI Chat
  static const String aiChat = '/ai/chat';
}
