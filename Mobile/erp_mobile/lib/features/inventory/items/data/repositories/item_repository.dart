import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/api/api_client.dart';
import '../../../../../core/api/api_constants.dart';
import '../../../../../core/models/paginated_response.dart';
import '../models/item_models.dart';

class ItemRepository {
  ItemRepository(this._dio);
  final dynamic _dio;

  Future<PaginatedResponse<ItemSummary>> fetchList({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? itemType,
  }) async {
    final resp = await _dio.get(ApiConstants.items, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (category != null && category.isNotEmpty) 'categoryId': category,
      if (itemType != null && itemType.isNotEmpty) 'itemType': itemType,
    });
    return PaginatedResponse.fromJson(
      resp.data as Map<String, dynamic>,
      (json) => ItemSummary.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<InventoryItem> fetchById(String id) async {
    final resp = await _dio.get('${ApiConstants.items}/$id');
    return InventoryItem.fromJson(resp.data as Map<String, dynamic>);
  }
}

final itemRepositoryProvider = Provider<ItemRepository>(
  (ref) => ItemRepository(ref.read(apiClientProvider)),
);
