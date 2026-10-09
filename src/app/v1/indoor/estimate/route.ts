import { liveForecast } from '../../../../../services/aqi/forecast/live';
import { answerIndoor } from '../../../../../services/aqi/indoor/http';

export async function POST(request: Request) {
  return answerIndoor(request, liveForecast.current);
}
