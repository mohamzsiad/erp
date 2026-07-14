import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colours.dart';
import '../../data/models/chat_models.dart';
import '../../providers/ai_chat_provider.dart';

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key});

  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _isSending = false;

  static const _suggestions = [
    'Total spend this month?',
    'Pending POs above 5,000 OMR',
    'Which supplier has highest spend?',
    'Stock value of REBAR-12MM',
    'PRs pending approval',
  ];

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _isSending) return;
    _controller.clear();
    setState(() => _isSending = true);
    await ref.read(aiChatProvider.notifier).sendMessage(trimmed);
    if (mounted) setState(() => _isSending = false);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(aiChatProvider);
    if (messages.isNotEmpty) _scrollToBottom();

    return Scaffold(
      backgroundColor: AppColours.background,
      appBar: AppBar(
        title: const Text('AI Assistant'),
        backgroundColor: AppColours.primary,
        foregroundColor: AppColours.surface,
        actions: [
          if (messages.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () =>
                  ref.read(aiChatProvider.notifier).clearHistory(),
              tooltip: 'Clear conversation',
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Messages ──────────────────────────────────────────────────────
          Expanded(
            child: messages.isEmpty
                ? _EmptyState(onSuggestion: _send)
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: messages.length,
                    itemBuilder: (ctx, i) {
                      final m = messages[i];
                      return m.id == 'thinking'
                          ? const _TypingIndicator()
                          : _MessageBubble(message: m);
                    },
                  ),
          ),
          // ── Input bar ─────────────────────────────────────────────────────
          _InputBar(
            controller: _controller,
            isSending: _isSending,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

// ── Empty / suggestion state ──────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onSuggestion});
  final ValueChanged<String> onSuggestion;

  static const _suggestions = [
    'Total spend this month?',
    'Pending POs above 5,000 OMR',
    'Which supplier has highest spend?',
    'Stock value of REBAR-12MM',
    'PRs pending approval',
  ];

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColours.kpiBlue,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chat_bubble_outline,
                  size: 48, color: AppColours.primary),
            ),
            const SizedBox(height: 16),
            Text(
              'Ask me anything about your ERP data',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: _suggestions
                  .map((s) => ActionChip(
                        label: Text(s, style: const TextStyle(fontSize: 12)),
                        backgroundColor: AppColours.surface,
                        side: const BorderSide(color: AppColours.cardBorder),
                        onPressed: () => onSuggestion(s),
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Message bubble ────────────────────────────────────────────────────────────
class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == ChatRole.user;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment:
            isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Bubble
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.78,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isUser ? AppColours.primary : AppColours.surface,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isUser ? 16 : 4),
                bottomRight: Radius.circular(isUser ? 4 : 16),
              ),
              border: isUser
                  ? null
                  : Border.all(color: AppColours.cardBorder),
            ),
            child: Text(
              message.content,
              style: TextStyle(
                color: isUser ? AppColours.surface : AppColours.textPrimary,
                fontSize: 14,
              ),
            ),
          ),

          // Data table (if present)
          if (!isUser &&
              message.data != null &&
              message.data!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: _DataTableCard(data: message.data!),
            ),

          // Chart (if present)
          if (!isUser && message.chartHint != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: _ChartCard(
                data: message.data ?? [],
                chartHint: message.chartHint!,
              ),
            ),
        ],
      ),
    );
  }
}

// ── Typing indicator ─────────────────────────────────────────────────────────
class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColours.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColours.cardBorder),
            ),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (_, __) {
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(
                    3,
                    (i) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Opacity(
                        opacity: ((_controller.value * 3 - i).clamp(0, 1) *
                                (1 - (_controller.value * 3 - i - 1).clamp(0, 1)))
                            .abs()
                            .clamp(0.3, 1.0),
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppColours.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data Table ────────────────────────────────────────────────────────────────
class _DataTableCard extends StatelessWidget {
  const _DataTableCard({required this.data});
  final List<Map<String, dynamic>> data;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();
    final columns = data.first.keys.toList();

    return Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.9,
      ),
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColours.cardBorder),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(AppColours.background),
          headingTextStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppColours.textPrimary),
          dataTextStyle: const TextStyle(
              fontSize: 12, color: AppColours.textPrimary),
          columnSpacing: 20,
          horizontalMargin: 12,
          columns: columns
              .map((c) => DataColumn(label: Text(c)))
              .toList(),
          rows: data
              .map((row) => DataRow(
                    cells: columns
                        .map((c) => DataCell(
                              Text('${row[c] ?? ''}'),
                            ))
                        .toList(),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

// ── Chart ─────────────────────────────────────────────────────────────────────
class _ChartCard extends StatelessWidget {
  const _ChartCard({required this.data, required this.chartHint});
  final List<Map<String, dynamic>> data;
  final String chartHint;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();

    // Detect axes
    final columns = data.first.keys.toList();
    final xKey = columns.firstWhere(
      (k) => data.first[k] is String,
      orElse: () => columns.first,
    );
    final yKey = columns.firstWhere(
      (k) => data.first[k] is num,
      orElse: () => columns.last,
    );

    return Container(
      height: 200,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColours.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColours.cardBorder),
      ),
      child: chartHint == 'bar'
          ? _buildBarChart(xKey, yKey)
          : _buildLineChart(xKey, yKey),
    );
  }

  Widget _buildBarChart(String xKey, String yKey) {
    final bars = data.asMap().entries.map((e) {
      final val = (e.value[yKey] as num?)?.toDouble() ?? 0;
      return BarChartGroupData(
        x: e.key,
        barRods: [
          BarChartRodData(
            toY: val,
            color: AppColours.primary,
            width: 14,
            borderRadius: BorderRadius.circular(4),
          )
        ],
      );
    }).toList();

    return BarChart(
      BarChartData(
        barGroups: bars,
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (v, _) {
                final i = v.toInt();
                if (i >= data.length) return const SizedBox.shrink();
                return Text(
                  '${data[i][xKey]}'.substring(0, '${data[i][xKey]}'.length.clamp(0, 6)),
                  style: const TextStyle(fontSize: 10),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLineChart(String xKey, String yKey) {
    final spots = data.asMap().entries.map((e) {
      final val = (e.value[yKey] as num?)?.toDouble() ?? 0;
      return FlSpot(e.key.toDouble(), val);
    }).toList();

    return LineChart(
      LineChartData(
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: AppColours.primary,
            barWidth: 2.5,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              color: AppColours.primary.withOpacity(0.1),
            ),
          ),
        ],
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: const FlTitlesData(
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
      ),
    );
  }
}

// ── Input Bar ─────────────────────────────────────────────────────────────────
class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.isSending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool isSending;
  final ValueChanged<String> onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 10,
        bottom: MediaQuery.of(context).viewInsets.bottom + 12,
      ),
      decoration: const BoxDecoration(
        color: AppColours.surface,
        border: Border(top: BorderSide(color: AppColours.cardBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              textInputAction: TextInputAction.send,
              onSubmitted: onSend,
              maxLines: 4,
              minLines: 1,
              decoration: InputDecoration(
                hintText: 'Ask about your ERP data…',
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: const BorderSide(color: AppColours.cardBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: const BorderSide(color: AppColours.cardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: const BorderSide(
                      color: AppColours.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            decoration: const BoxDecoration(
              color: AppColours.primary,
              shape: BoxShape.circle,
            ),
            child: isSending
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: AppColours.surface,
                        strokeWidth: 2,
                      ),
                    ),
                  )
                : IconButton(
                    icon: const Icon(Icons.send,
                        color: AppColours.surface, size: 20),
                    onPressed: () => onSend(controller.text),
                  ),
          ),
        ],
      ),
    );
  }
}
