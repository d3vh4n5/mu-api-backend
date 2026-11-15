/**
 * Rutas dentro de /downloads (PUBLIC_DIR/downloads). Son las mismas que usa el
 * launcher para armar las URLs, así que cambiarlas rompe los launchers instalados.
 */
export const CLIENT_REL_DIR = 'Mu99bClassic/Client';
export const MANIFEST_REL_PATH = 'Mu99bClassic/manifest.json';
export const LAUNCHER_REL_PATH = `${CLIENT_REL_DIR}/launcher.exe`;
export const UPDATER_REL_PATH = `${CLIENT_REL_DIR}/Data/Launcher/updater.exe`;
