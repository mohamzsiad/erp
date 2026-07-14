import 'package:freezed_annotation/freezed_annotation.dart';

part 'kpi_data.freezed.dart';
part 'kpi_data.g.dart';

@freezed
class KpiData with _$KpiData {
  const factory KpiData({
    required ProcurementKpi procurement,
    required InventoryKpi inventory,
    required FinanceKpi finance,
    @Default([]) List<Map<String, dynamic>> recentActivity,
  }) = _KpiData;

  factory KpiData.fromJson(Map<String, dynamic> json) =>
      _$KpiDataFromJson(json);
}

@freezed
class ProcurementKpi with _$ProcurementKpi {
  const factory ProcurementKpi({
    @Default(0) int pendingPrCount,
    @Default(0) int pendingPoCount,
    @Default(0.0) double pendingPoValue,
    @Default(0) int overduePoCount,
  }) = _ProcurementKpi;

  factory ProcurementKpi.fromJson(Map<String, dynamic> json) =>
      _$ProcurementKpiFromJson(json);
}

@freezed
class InventoryKpi with _$InventoryKpi {
  const factory InventoryKpi({
    @Default(0.0) double totalStockValue,
    @Default(0) int lowStockCount,
    @Default(0) int pendingGrnCount,
    @Default(0.0) double deadStockValue,
  }) = _InventoryKpi;

  factory InventoryKpi.fromJson(Map<String, dynamic> json) =>
      _$InventoryKpiFromJson(json);
}

@freezed
class FinanceKpi with _$FinanceKpi {
  const factory FinanceKpi({
    @Default(0.0) double totalApOutstanding,
    @Default(0.0) double totalArOutstanding,
    @Default(0) int overdueApCount,
    @Default(0) int overdueArCount,
    @Default(0.0) double monthlyRevenue,
    @Default(0.0) double monthlyExpense,
  }) = _FinanceKpi;

  factory FinanceKpi.fromJson(Map<String, dynamic> json) =>
      _$FinanceKpiFromJson(json);
}
