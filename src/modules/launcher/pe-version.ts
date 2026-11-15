/**
 * Lee la versión (FileVersion) de los metadatos de un .exe de Windows (PE),
 * la misma que muestra Propiedades > Detalles. Sin dependencias.
 *
 * Busca la estructura VS_FIXEDFILEINFO (firma 0xFEEF04BD) dentro de la sección
 * de recursos `.rsrc`. Se limita a esa sección porque los exe de PyInstaller
 * llevan un archivo comprimido pegado al final donde la firma podría aparecer
 * por casualidad.
 */

const VS_FIXEDFILEINFO_SIGNATURE = 0xfeef04bd;
const VS_FIXEDFILEINFO_STRUC_VERSION = 0x00010000;

export function readPeFileVersion(buf: Buffer): string | null {
  if (buf.length < 0x40 || buf.toString('latin1', 0, 2) !== 'MZ') return null;

  const peOffset = buf.readUInt32LE(0x3c);
  if (
    peOffset + 24 > buf.length ||
    buf.toString('latin1', peOffset, peOffset + 4) !== 'PE\0\0'
  ) {
    return null;
  }

  const numberOfSections = buf.readUInt16LE(peOffset + 6);
  const sizeOfOptionalHeader = buf.readUInt16LE(peOffset + 20);
  const sectionTable = peOffset + 24 + sizeOfOptionalHeader;

  for (let i = 0; i < numberOfSections; i++) {
    const s = sectionTable + i * 40;
    if (s + 40 > buf.length) break;

    const name = buf.toString('latin1', s, s + 8).replace(/\0+$/, '');
    if (name !== '.rsrc') continue;

    const sizeOfRawData = buf.readUInt32LE(s + 16);
    const pointerToRawData = buf.readUInt32LE(s + 20);
    const end = Math.min(pointerToRawData + sizeOfRawData, buf.length) - 24;

    // VS_FIXEDFILEINFO está alineado a 4 bytes
    for (let off = pointerToRawData; off <= end; off += 4) {
      if (
        buf.readUInt32LE(off) === VS_FIXEDFILEINFO_SIGNATURE &&
        buf.readUInt32LE(off + 4) === VS_FIXEDFILEINFO_STRUC_VERSION
      ) {
        const ms = buf.readUInt32LE(off + 8);
        const ls = buf.readUInt32LE(off + 12);
        const parts = [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff];
        // "1.2.7.0" -> "1.2.7" para que coincida con VERSION del launcher
        if (parts[3] === 0) parts.pop();
        return parts.join('.');
      }
    }
    return null;
  }

  return null;
}
