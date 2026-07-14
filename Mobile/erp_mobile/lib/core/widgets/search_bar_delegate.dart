import 'package:flutter/material.dart';

import '../theme/app_colours.dart';

/// A reusable search input bar widget (not a SearchDelegate).
class ErpSearchBar extends StatefulWidget {
  const ErpSearchBar({
    super.key,
    required this.onChanged,
    this.hintText = 'Search...',
    this.onClear,
  });

  final ValueChanged<String> onChanged;
  final String hintText;
  final VoidCallback? onClear;

  @override
  State<ErpSearchBar> createState() => _ErpSearchBarState();
}

class _ErpSearchBarState extends State<ErpSearchBar> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      decoration: InputDecoration(
        hintText: widget.hintText,
        prefixIcon: const Icon(Icons.search, color: AppColours.textHint),
        suffixIcon: _controller.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear, color: AppColours.textHint),
                onPressed: () {
                  _controller.clear();
                  widget.onChanged('');
                  widget.onClear?.call();
                },
              )
            : null,
        filled: true,
        fillColor: AppColours.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.cardBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColours.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      ),
    );
  }
}
