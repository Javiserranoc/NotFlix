import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';

import { MoviesKindProvider } from '../../movies/components/KindSwitch';
import { MoviesTabBar, TabItem } from '../../movies/components/MoviesTabBar';

/**
 * Pestañas del módulo con barra propia (la "entrada de cine").
 * `asChild` deja que TabList y TabTrigger presten su comportamiento a
 * componentes nuestros: el resaltado lo decide el router con `isFocused`.
 */
export default function MoviesTabsLayout() {
  return (
    <MoviesKindProvider>
      <Tabs>
        {/* TabSlot no encoge por defecto: crecería con el contenido y no habría scroll. */}
        <TabSlot style={{ flexShrink: 1 }} />
        <TabList asChild>
          <MoviesTabBar>
            <TabTrigger name="index" href="/" asChild>
              <TabItem icon="home-variant" label="Inicio" />
            </TabTrigger>
            <TabTrigger name="biblioteca" href="/biblioteca" asChild>
              <TabItem icon="bookshelf" label="Biblioteca" />
            </TabTrigger>
            <TabTrigger name="numeros" href="/numeros" asChild>
              <TabItem icon="chart-box-outline" label="Números" />
            </TabTrigger>
          </MoviesTabBar>
        </TabList>
      </Tabs>
    </MoviesKindProvider>
  );
}
