import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import 'core/theme.dart';
import 'router.dart';

/// Root widget: MaterialApp.router with the Pikavolt dark theme.
class PikavoltApp extends ConsumerWidget {
  const PikavoltApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Pikavolt',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: AppTheme.dark(),
      darkTheme: AppTheme.dark(),
      routerConfig: router,
    );
  }
}
