import 'server-only';
import { unstable_cache } from 'next/cache';
import ExcelJS from 'exceljs';
import { TEAMS } from './teams';
import { downloadFile, getMeta } from './drive';
import { worksheetToGrid, pickSheet } from './sheet';
import { parseGrid, stripPositions, filterTeam } from './parse';

async function loadTeam(team) {
  const cfg = TEAMS[team];
  const [buf, meta] = await Promise.all([downloadFile(cfg.fileId), getMeta(cfg.fileId)]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = pickSheet(wb, cfg.sheet);
  const raw = parseGrid(worksheetToGrid(ws));
  if (!raw) throw new Error(`No se encontró la tabla en la hoja "${ws.name}".`);
  const { otros, ...parsed } = filterTeam(raw, team);
  return {
    team,
    label: cfg.label,
    fileName: meta.name,
    modifiedTime: meta.modifiedTime,
    sheet: ws.name,
    fetchedAt: new Date().toISOString(),
    ...stripPositions(parsed),
  };
}

// Drive se lee una vez y queda en caché hasta la próxima carga de archivo (revalidateTag en /api/save).
export function getTeam(team) {
  return unstable_cache(() => loadTeam(team), ['edl-data', team], {
    revalidate: false,
    tags: [`edl-${team}`],
  })();
}

export async function getTeamSafe(team) {
  try {
    return await getTeam(team);
  } catch (e) {
    return { team, label: TEAMS[team].label, error: e.message };
  }
}

