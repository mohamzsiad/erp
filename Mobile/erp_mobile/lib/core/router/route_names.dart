/// Named route constants used throughout the app.
class RouteNames {
  RouteNames._();

  static const String login        = 'login';
  static const String dashboard    = 'dashboard';
  static const String approvals    = 'approvals';
  static const String notifications = 'notifications';
  static const String aiChat       = 'ai-chat';
  static const String profile      = 'profile';

  // Procurement
  static const String mrlList   = 'mrl-list';
  static const String mrlNew    = 'mrl-new';
  static const String mrlDetail = 'mrl-detail';

  static const String prlList   = 'prl-list';
  static const String prlNew    = 'prl-new';
  static const String prlDetail = 'prl-detail';

  static const String poList   = 'po-list';
  static const String poNew    = 'po-new';
  static const String poDetail = 'po-detail';

  // Inventory
  static const String itemList   = 'item-list';
  static const String itemDetail = 'item-detail';

  static const String grnList   = 'grn-list';
  static const String grnDetail = 'grn-detail';
  static const String grnNew    = 'grn-new';

  static const String issueList   = 'issue-list';
  static const String issueDetail = 'issue-detail';
  static const String issueNew    = 'issue-new';
  // Aliases
  static const String stockIssueList   = issueList;
  static const String stockIssueDetail = issueDetail;
  static const String stockIssueNew    = issueNew;

  static const String stockSummary = 'stock-summary';

  // Finance
  static const String apInvoiceList   = 'ap-invoice-list';
  static const String apInvoiceDetail = 'ap-invoice-detail';
  static const String apPaymentList   = 'ap-payment-list';
  static const String apPaymentDetail = 'ap-payment-detail';

  static const String arInvoiceList   = 'ar-invoice-list';
  static const String arInvoiceDetail = 'ar-invoice-detail';

  static const String journalList        = 'journal-list';
  static const String journalDetail      = 'journal-detail';
  // Aliases
  static const String journalEntryList   = journalList;
  static const String journalEntryDetail = journalDetail;

  static const String budgets = 'budgets';
}
