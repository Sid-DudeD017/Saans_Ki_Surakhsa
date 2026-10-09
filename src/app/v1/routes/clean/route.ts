import { liveForecast } from '../../../../../services/aqi/forecast/live';
import { answerCleanRoute } from '../../../../../services/aqi/routes/http';
import { osrmProvider } from '../../../../../services/aqi/routes/providers';

const provider = osrmProvider();

export async function POST(request: Request) {
  return answerCleanRoute(request, liveForecast.current, provider);
}
