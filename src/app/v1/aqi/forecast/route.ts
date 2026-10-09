import { answerForecast } from '../../../../../services/aqi/forecast/http';
import { liveForecast } from '../../../../../services/aqi/forecast/live';

export async function GET(request: Request) {
  return answerForecast(new URL(request.url), liveForecast.current);
}
