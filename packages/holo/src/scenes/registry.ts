/**
 * Catálogo de escenas. Para agregar contenido:
 *  1. Escribir un módulo que cumpla SceneModule (ver types.ts).
 *  2. Registrarlo aquí y en SCENE_IDS de @rikuy/core (validarComandos).
 *  3. Opcional: un modelo glTF real en public/models/<id>.glb lo reemplaza
 *     automáticamente (ver SceneManager.loadOverride).
 */
import type { SceneModule } from './types.ts';
import { enterocito, higado, intestino, lobulillo, respiratorio, vellosidad } from './anatomy.ts';
import { digestivo } from './digestivo/escena.ts';
import { lactasa } from './lactasa.ts';
import { pendulo } from './pendulo.ts';

export const SCENES: Record<string, () => SceneModule> = {
  digestivo,
  intestino,
  vellosidad,
  enterocito,
  lactasa,
  respiratorio,
  higado,
  lobulillo,
  pendulo,
};
