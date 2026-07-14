import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/chat_models.dart';
import '../data/repositories/ai_chat_repository.dart';

class AiChatNotifier extends Notifier<List<ChatMessage>> {
  @override
  List<ChatMessage> build() => [];

  Future<void> sendMessage(String text) async {
    // Add user message
    final userMsg = ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      role: ChatRole.user,
      content: text,
      timestamp: DateTime.now(),
    );
    state = [...state, userMsg];

    // Add typing placeholder
    const thinkingId = 'thinking';
    state = [
      ...state,
      const ChatMessage(id: thinkingId, role: ChatRole.assistant, content: '...'),
    ];

    try {
      final history = state
          .where((m) => m.id != thinkingId)
          .map((m) => ChatHistoryItem(
                role: m.role == ChatRole.user ? 'user' : 'assistant',
                content: m.content,
              ))
          .toList();

      final response = await ref
          .read(aiChatRepositoryProvider)
          .sendMessage(message: text, history: history);

      final assistantMsg = ChatMessage(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        role: ChatRole.assistant,
        content: response.answer,
        timestamp: DateTime.now(),
        data: response.data,
        chartHint: response.chartHint,
      );

      state = state.where((m) => m.id != thinkingId).toList()
        ..add(assistantMsg);
    } catch (e) {
      final errorMsg = ChatMessage(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        role: ChatRole.assistant,
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: DateTime.now(),
      );
      state = state.where((m) => m.id != thinkingId).toList()
        ..add(errorMsg);
    }
  }

  void clearHistory() => state = [];
}

final aiChatProvider =
    NotifierProvider<AiChatNotifier, List<ChatMessage>>(AiChatNotifier.new);
