import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/journal_entry_models.dart';

class JournalEntryRepository {
  JournalEntryRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<JournalEntrySummary>> fetchList({
    int page = 1, int limit = 20, String? search, String? status,
  }) async {
    final resp = await _dio.get(ApiConstants.journalEntries, queryParameters: {
      'page': page, 'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => JournalEntrySummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<JournalEntry> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.journalEntries}/$id');
    return JournalEntry.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> post(String id) async =>
      _dio.post('${ApiConstants.journalEntries}/$id/post');

  Future<void> reverse(String id) async =>
      _dio.post('${ApiConstants.journalEntries}/$id/reverse');
}

final journalEntryRepositoryProvider = Provider<JournalEntryRepository>(
  (ref) => JournalEntryRepository(ref.read(apiClientProvider)),
);
