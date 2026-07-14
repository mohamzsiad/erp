import 'package:flutter/material.dart';

import '../theme/app_colours.dart';

/// Colour-coded document status chip.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (color, label) = _resolve(status.toUpperCase());
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  static (Color, String) _resolve(String status) => switch (status) {
        'DRAFT'         => (AppColours.statusDraft,     'Draft'),
        'SUBMITTED'     => (AppColours.statusSubmitted,  'Submitted'),
        'APPROVED'      => (AppColours.statusApproved,   'Approved'),
        'REJECTED'      => (AppColours.statusRejected,   'Rejected'),
        'CANCELLED'     => (AppColours.statusCancelled,  'Cancelled'),
        'PARTIAL'       => (AppColours.statusPartial,    'Partial'),
        'POSTED'        => (AppColours.statusPosted,     'Posted'),
        'PAID'          => (AppColours.statusPaid,       'Paid'),
        'CLOSED'        => (AppColours.statusClosed,     'Closed'),
        'PO_CREATED'    => (AppColours.statusPoCreated,  'PO Created'),
        'ENQUIRY_SENT'  => (AppColours.statusEnquiry,    'Enquiry Sent'),
        'CONVERTED'     => (AppColours.statusPoCreated,  'Converted'),
        'RECEIVED'      => (AppColours.statusApproved,   'Received'),
        'INVOICED'      => (AppColours.statusPosted,     'Invoiced'),
        'MATCHED'       => (AppColours.statusApproved,   'Matched'),
        'MISMATCH'      => (AppColours.statusRejected,   'Mismatch'),
        'PENDING'       => (AppColours.statusSubmitted,  'Pending'),
        'ACTIVE'        => (AppColours.statusApproved,   'Active'),
        'INACTIVE'      => (AppColours.statusCancelled,  'Inactive'),
        'DISCONTINUED'  => (AppColours.statusClosed,     'Discontinued'),
        _               => (AppColours.statusDraft,      status),
      };
}
