import { liveForecast } from '../../../../../services/aqi/forecast/live';
import { amazonProvider } from '../../../../../services/aqi/routes/amazon';
import { answerCleanRoute } from '../../../../../services/aqi/routes/http';
import { osrmProvider } from '../../../../../services/aqi/routes/providers';

// ROUTES_PROVIDER=amazon uses Amazon Location (with traffic, needs AWS credentials), falling back to OSRM.
const osrm = osrmProvider();
const provider = process.env.ROUTES_PROVIDER === 'amazon' ? amazonProvider(osrm) : osrm;

export async function POST(request: Request) {
  return answerCleanRoute(request, liveForecast.current, provider);
}
