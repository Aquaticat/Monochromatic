/**
 * paper2vn entry point.
 *
 * Boots i18n, registers screens with the router, applies persisted
 * font scale, then navigates to the main menu. All other behavior
 * lives in the screen modules.
 */
import { bootI18n, } from './i18n/runtime.ts';
import { navigate, } from './router.ts';
import { registerLecture, } from './screens/lecture.ts';
import { registerLog, } from './screens/log.ts';
import { registerMenu, } from './screens/menu.ts';
import { registerSaves, } from './screens/saves.ts';
import { registerSelectTopic, } from './screens/select-topic.ts';
import { registerSettings, } from './screens/settings.ts';
import { getSettings, } from './state.ts';

bootI18n();

document.documentElement
  .style
  .setProperty(
  '--font-scale',
  String(getSettings()
    .fontScale,),
);

registerMenu();
registerSelectTopic();
registerLecture();
registerSettings();
registerSaves();
registerLog();

navigate('menu',);
