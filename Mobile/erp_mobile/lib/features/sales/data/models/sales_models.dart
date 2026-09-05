/// Lightweight list DTOs for the mobile Sales feature.
///
/// These mirror the list payloads returned by the CloudERP `/sales/*` endpoints.
/// Full detail/editing screens can be layered on later; the mobile app currently
/// surfaces read-only lists for field/on-the-go visibility.

double _toDouble(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
String _s(dynamic v) => v?.toString() ?? '';

class SalesCustomer {
  SalesCustomer({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    required this.creditLimit,
    required this.creditHold,
    required this.isActive,
  });

  final String id;
  final String code;
  final String name;
  final String type;
  final double creditLimit;
  final bool creditHold;
  final bool isActive;

  factory SalesCustomer.fromJson(Map<String, dynamic> j) => SalesCustomer(
        id: _s(j['id']),
        code: _s(j['code']),
        name: _s(j['name']),
        type: _s(j['type']),
        creditLimit: _toDouble(j['creditLimit']),
        creditHold: j['creditHold'] == true,
        isActive: j['isActive'] == true,
      );
}

class SalesDoc {
  SalesDoc({
    required this.id,
    required this.docNo,
    required this.partyName,
    required this.date,
    required this.status,
    required this.amount,
  });

  final String id;
  final String docNo;
  final String partyName;
  final String date;
  final String status;
  final double amount;

  /// Flexible mapper — handles quotation / order / invoice list shapes.
  factory SalesDoc.fromJson(Map<String, dynamic> j) => SalesDoc(
        id: _s(j['id']),
        docNo: _s(j['docNo']),
        partyName: _s(j['customerName'] ?? j['projectName'] ?? ''),
        date: _s(j['quotationDate'] ?? j['orderDate'] ?? j['invoiceDate'] ?? j['billDate'] ?? ''),
        status: _s(j['status']),
        amount: _toDouble(j['totalAmount'] ?? j['amount']),
      );
}

/// Envelope for paginated `{ data, total }` responses.
class Paged<T> {
  Paged(this.data, this.total);
  final List<T> data;
  final int total;

  factory Paged.from(dynamic body, T Function(Map<String, dynamic>) fromJson) {
    final map = (body as Map<String, dynamic>? ?? {});
    final list = (map['data'] as List<dynamic>? ?? []);
    return Paged(list.map((e) => fromJson(e as Map<String, dynamic>)).toList(), (map['total'] as num?)?.toInt() ?? list.length);
  }
}
