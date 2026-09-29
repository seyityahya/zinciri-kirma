import 'expo-router/entry';

import { Platform } from 'react-native';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { WidgetConfigScreen } from '@/widgets/android/config-screen';
import { widgetTaskHandler } from '@/widgets/android/task-handler';

// Android ana ekran widget'ları: arka plan görevi ve "zincir seç" ekranı.
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
  registerWidgetConfigurationScreen(WidgetConfigScreen);
}
