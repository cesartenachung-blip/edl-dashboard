import Dashboard from '@/components/Dashboard';
import { getTeamSafe } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [principal, next] = await Promise.all([getTeamSafe('principal'), getTeamSafe('next')]);
  return <Dashboard principal={principal} next={next} uploadKeyRequired={!!process.env.UPLOAD_KEY} detalleKeyRequired={!!process.env.DETALLE_KEY} />;
}
