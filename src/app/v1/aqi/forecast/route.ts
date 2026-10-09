import { answerForecast } from '../../../../../services/aqi/forecast/http';
import { forecastService, liveDeps } from '../../../../../services/aqi/forecast/service';

// One per server process, so the grid is fetched once and then answered from memory.
const service = forecastService(liveDeps());

export async function GET(request: Request) {
  return answerForecast(new URL(request.url), service.current);
}
